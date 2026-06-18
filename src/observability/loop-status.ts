/**
 * LoopStatus — Expose loop health and stalled stage diagnostics.
 *
 * Core logic: Call assembleLoopStatus, format into v8 loop_status shape,
 * and include policy-denied closure counts.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md`
 *
 * Dependencies:
 * - `src/observability/causal-loop-health.js` (assembleLoopStatus)
 * - `src/storage/v8-state-stores.js` (readLoopStageEventsByStage)
 *
 * Boundary:
 * - Read-only diagnostic query; does not modify state.
 * - Returns degraded envelope when state unreadable.
 *
 * Test coverage: tests/unit/observability/loop-status.test.ts
 */

import type { StateDatabase } from "../storage/db/index.js";
import { assembleLoopStatus } from "./causal-loop-health.js";
import { checkRealRunHealth, type RealRunHealthGate } from "./living-loop-health-gate.js";
import {
  readActionClosuresByDay,
  readConnectorCooldownState,
} from "../storage/v8-state-stores.js";
import type { DegradedOperationResult, LoopStage } from "../shared/types/v8-contracts.js";

import type { EvidenceLevel } from "../shared/types/v8-contracts.js";
import { classifyEvidenceLevel } from "../shared/evidence-level-classifier.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface RealRunHealthProjection {
  gatePassed: boolean;
  contractSmokeOnly: boolean;
  seededStateDetected: boolean;
  hasRealClosure: boolean;
  hasQuietArtifact: boolean;
  hasDreamArtifact: boolean;
  hasFreshImpulseContext: boolean;
  hasProjectionFeedback: boolean;
  missingStage?: string;
  missingReason?: string;
}

export interface LoopStatusReadModel {
  ok: true;
  overallStatus: string;
  stalledAt?: string;
  lastCycleSequence: number;
  lastHeartbeatAt?: string;
  stageSummaries: StageSummary[];
  policyDeniedCount: number;
  hardGuardDeniedCount: number;
  cooldownReplayCount: number;
  sourceAbsenceCount: number;
  quietSuppressionCount: number;
  connectorTerminalCount: number;
  nextAction: string;
  realRunHealth: RealRunHealthProjection;
  evidenceLevel: EvidenceLevel;
}

export interface StageSummary {
  stage: string;
  eventCount: number;
  stalled: boolean;
  lastEventAt?: string;
}

export type LoopStatusResult =
  | { ok: true; status: LoopStatusReadModel }
  | { ok: false; degraded: DegradedOperationResult };

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function computeNextAction(
  overallStatus: "healthy" | "degraded" | "stalled" | "no_data",
  stalledAt?: LoopStage,
  realRunMissingStage?: string,
  realRunMissingReason?: string,
  attribution?: DenialAttribution,
): string {
  // Real-run health takes precedence over generic causal health
  if (realRunMissingStage && realRunMissingStage !== "none") {
    return `Real-run health degraded: ${realRunMissingReason ?? `missing stage: ${realRunMissingStage}`}. Run a real heartbeat cycle or verify daily rhythm state.`;
  }
  if (overallStatus === "healthy") {
    return "No operator action required. Loop is progressing normally.";
  }
  if (overallStatus === "no_data") {
    return "Run a heartbeat cycle or check connector configuration to generate initial evidence.";
  }
  if (overallStatus === "degraded") {
    return "Check state database connectivity and retry. If persistent, review logs for state_unreadable errors.";
  }
  if (overallStatus === "stalled" && stalledAt) {
    const actions: Record<LoopStage, string> = {
      ingestion: "Verify connector credentials and platform availability. Check ingestion_connector_failed events.",
      perception: "Check perception model availability or rules-only fallback. Review evidence_batch_empty vs perception_blocked_redaction.",
      judgment: "Review judgment_low_confidence or judgment_missing_source_refs. Ensure perception cards have valid source refs.",
      policy: "Review policy_denied_high_risk or policy_denied_missing_permission. Check affordance map and breaker status.",
      execution: "Verify connector executor and guidance port availability. Check execution_unavailable or execution_timeout events.",
      closure: "Check closure_missing or closure_failed. Verify state write validation and idempotency key uniqueness.",
      quiet: "Quiet review may be empty or failed. Check quiet_empty_input or quiet_failed events. Daily review triggers after 36h window.",
      dream: "Dream scheduler may be unavailable or redaction blocked. Check dream_scheduler_unavailable or dream_blocked_redaction events.",
      projection: "Projection may be rejected or missing source refs. Check projection_rejected events and candidate validation.",
    };
    return actions[stalledAt] ?? `Review ${stalledAt} stage events for blocked or failed status.`;
  }
  return "Review loop stage events and state database health.";
}

// ───────────────────────────────────────────────────────────────
// Denial / replay attribution (T-OBS.R.4)
// ───────────────────────────────────────────────────────────────

const CONNECTOR_TERMINAL_REASONS: ReadonlySet<string> = new Set([
  "auth_failure",
  "credential_expired",
  "verification_required",
  "configuration_missing",
  "platform_unavailable",
  "transport_failure",
  "rate_limited",
  "timeout",
  "script_error",
  "parse_failure",
  "protocol_mismatch",
  "semantic_rejection",
  "permanent_input_error",
  "unknown_platform_change",
]);

function classifyReasonToTerminal(reason: string): boolean {
  return CONNECTOR_TERMINAL_REASONS.has(reason);
}

export interface DenialAttribution {
  policyDeniedCount: number;
  hardGuardDeniedCount: number;
  cooldownReplayCount: number;
  sourceAbsenceCount: number;
  quietSuppressionCount: number;
  connectorTerminalCount: number;
}

function emptyAttribution(): DenialAttribution {
  return {
    policyDeniedCount: 0,
    hardGuardDeniedCount: 0,
    cooldownReplayCount: 0,
    sourceAbsenceCount: 0,
    quietSuppressionCount: 0,
    connectorTerminalCount: 0,
  };
}

export async function attributeDenials(
  db: StateDatabase,
  options?: { day?: string; cycleWindowHours?: number },
): Promise<DenialAttribution> {
  const targetDay = options?.day ?? new Date().toISOString().slice(0, 10);
  const readResult = await readActionClosuresByDay(db, targetDay);
  if (readResult.degraded) {
    return emptyAttribution();
  }

  const attribution = emptyAttribution();

  for (const closure of readResult.rows) {
    const status = closure.status;
    const reason = closure.reason ?? "";

    // Cooldown/replay is determined from durable cooldown state per platform/capability.
    if (
      (status === "denied" || status === "downgraded" || status === "deferred") &&
      closure.platformId &&
      closure.capabilityId
    ) {
      const cooldownResult = await readConnectorCooldownState(db, closure.platformId, closure.capabilityId);
      if (cooldownResult.row?.blockedUntil && new Date(cooldownResult.row.blockedUntil) > new Date()) {
        attribution.cooldownReplayCount += 1;
        continue;
      }
    }

    const terminalClass = classifyReasonToTerminal(reason);
    const isCooldownReplay = reason === "cooldown_blocked" || reason === "replay_suppressed";
    const isQuietSuppression = reason === "guidance_unavailable" || reason === "quiet_empty_input" || reason === "quiet_suppression";

    if (isCooldownReplay) {
      attribution.cooldownReplayCount += 1;
      continue;
    }

    if (status === "denied") {
      if (reason.startsWith("policy_denied")) {
        attribution.policyDeniedCount += 1;
      } else if (terminalClass) {
        attribution.connectorTerminalCount += 1;
      } else if (
        reason === "source_refs_missing" ||
        reason === "affordance_unavailable" ||
        reason === "awaiting_user" ||
        reason === "permission_missing"
      ) {
        attribution.hardGuardDeniedCount += 1;
      } else {
        attribution.policyDeniedCount += 1;
      }
      continue;
    }

    if (status === "downgraded" || status === "deferred") {
      if (isQuietSuppression) {
        attribution.quietSuppressionCount += 1;
      } else if (terminalClass) {
        attribution.connectorTerminalCount += 1;
      }
      continue;
    }

    if (status === "no_action") {
      if (reason === "evidence_batch_empty" || reason === "quiet_empty_input") {
        attribution.sourceAbsenceCount += 1;
      } else if (terminalClass) {
        attribution.connectorTerminalCount += 1;
      }
      continue;
    }

    if (status === "completed" || status === "failed") {
      if (terminalClass) {
        attribution.connectorTerminalCount += 1;
      }
      continue;
    }
  }

  return attribution;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function readLoopStatus(
  db: StateDatabase,
): Promise<LoopStatusResult> {
  const health = await assembleLoopStatus(db, { limit: 50 });

  if ("status" in health && health.status === "degraded") {
    return {
      ok: false,
      degraded: health as DegradedOperationResult,
    };
  }

  const snapshot = health as import("./causal-loop-health.js").CausalLoopHealthSnapshot;

  // T-OBS.R.3: Consume real-run health gate
  const realRunResult = await checkRealRunHealth(db);
  let realRunHealth: RealRunHealthProjection;
  if (realRunResult.ok) {
    realRunHealth = {
      gatePassed: realRunResult.gate.gatePassed,
      contractSmokeOnly: realRunResult.gate.contractSmokeOnly,
      seededStateDetected: realRunResult.gate.seededStateDetected,
      hasRealClosure: realRunResult.gate.hasRealClosure,
      hasQuietArtifact: realRunResult.gate.hasQuietArtifact,
      hasDreamArtifact: realRunResult.gate.hasDreamArtifact,
      hasFreshImpulseContext: realRunResult.gate.hasFreshImpulseContext,
      hasProjectionFeedback: realRunResult.gate.hasProjectionFeedback,
      missingStage: realRunResult.gate.missingStage,
      missingReason: realRunResult.gate.missingReason,
    };
  } else {
    realRunHealth = {
      gatePassed: false,
      contractSmokeOnly: false,
      seededStateDetected: false,
      hasRealClosure: false,
      hasQuietArtifact: false,
      hasDreamArtifact: false,
      hasFreshImpulseContext: false,
      hasProjectionFeedback: false,
      missingReason: "Real-run health check degraded: " + (realRunResult.degraded.operatorNextAction || "unknown"),
    };
  }

  // Override overallStatus based on real-run health parity
  let overallStatus = snapshot.overallStatus;
  let stalledAt = snapshot.stalledAt;
  if (!realRunHealth.gatePassed) {
    // Real-run gate fails → cannot report healthy
    if (overallStatus === "healthy") {
      overallStatus = "degraded";
    }
  } else {
    // Real-run gate passes → all stages have evidence, ignore staged-event-only stall
    overallStatus = "healthy";
    stalledAt = undefined;
  }

  // T-OBS.R.7: derive evidenceLevel from observed proof
  const evidenceLevel = classifyEvidenceLevel({
    hasCarrierEnvelope: true, // loop_status command envelope itself
    hasContractSmoke: snapshot.lastCycleSequence > 0 && !realRunHealth.hasRealClosure,
    hasStatePresent:
      snapshot.lastCycleSequence === 0 &&
      (realRunHealth.hasQuietArtifact ||
        realRunHealth.hasDreamArtifact ||
        realRunHealth.hasProjectionFeedback),
    hasCycleExecution: snapshot.lastCycleSequence > 0 && realRunHealth.hasRealClosure,
    hasReadbackVerification: realRunHealth.gatePassed,
  });

  const stageSummaries: StageSummary[] = snapshot.stages.map((s) => ({
    stage: s.stage,
    eventCount: s.eventCount,
    stalled: s.stalled,
    lastEventAt: s.lastEventAt,
  }));

  // T-OBS.R.4: Attribute denials and connector replay root causes
  const attribution = await attributeDenials(db);

  const nextAction = computeNextAction(
    overallStatus as "healthy" | "degraded" | "stalled" | "no_data",
    stalledAt,
    realRunHealth.missingStage,
    realRunHealth.missingReason,
    attribution,
  );

  return {
    ok: true,
    status: {
      ok: true,
      overallStatus,
      stalledAt,
      lastCycleSequence: snapshot.lastCycleSequence,
      lastHeartbeatAt: snapshot.lastHeartbeatAt,
      stageSummaries,
      policyDeniedCount: attribution.policyDeniedCount,
      hardGuardDeniedCount: attribution.hardGuardDeniedCount,
      cooldownReplayCount: attribution.cooldownReplayCount,
      sourceAbsenceCount: attribution.sourceAbsenceCount,
      quietSuppressionCount: attribution.quietSuppressionCount,
      connectorTerminalCount: attribution.connectorTerminalCount,
      nextAction,
      realRunHealth,
      evidenceLevel,
    },
  };
}
