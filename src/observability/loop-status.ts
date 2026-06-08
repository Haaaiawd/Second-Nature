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
import type { DegradedOperationResult, LoopStage } from "../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface LoopStatusReadModel {
  ok: true;
  overallStatus: string;
  stalledAt?: string;
  lastCycleSequence: number;
  lastHeartbeatAt?: string;
  stageSummaries: StageSummary[];
  policyDeniedCount: number;
  nextAction: string;
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
): string {
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

  const stageSummaries: StageSummary[] = snapshot.stages.map((s) => ({
    stage: s.stage,
    eventCount: s.eventCount,
    stalled: s.stalled,
    lastEventAt: s.lastEventAt,
  }));

  // Policy denied count is a placeholder; real implementation would query action closures
  const policyDeniedCount = 0;

  const nextAction = computeNextAction(snapshot.overallStatus, snapshot.stalledAt);

  return {
    ok: true,
    status: {
      ok: true,
      overallStatus: snapshot.overallStatus,
      stalledAt: snapshot.stalledAt,
      lastCycleSequence: snapshot.lastCycleSequence,
      lastHeartbeatAt: snapshot.lastHeartbeatAt,
      stageSummaries,
      policyDeniedCount,
      nextAction,
    },
  };
}
