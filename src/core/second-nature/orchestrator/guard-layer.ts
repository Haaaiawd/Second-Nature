import type { CandidateIntent, ContinuitySnapshot, GuardEvaluation } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import { buildHeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { AffordanceMap, AffordanceItem } from "../../../shared/types/v7-entities.js";

const QUIET_DENY_KINDS = ["outreach", "social"] as const;

function intentFingerprint(intent: CandidateIntent): string {
  return intent.idempotencyKey ?? `${intent.kind}:${intent.summary}`;
}

function isBudgetExceeded(intent: CandidateIntent, snapshot: ContinuitySnapshot): boolean {
  if (intent.kind !== "social") return false;
  if (!snapshot.budgets) return false;
  return snapshot.budgets.socialUsed >= snapshot.budgets.socialLimit;
}

function isQuietSuppressed(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot): boolean {
  if (!runtime.rhythmWindow.quietBias) return false;
  if (QUIET_DENY_KINDS.includes(intent.kind as (typeof QUIET_DENY_KINDS)[number])) {
    return true;
  }
  if (intent.effectClass === "connector_action" || intent.effectClass === "external_platform_action") {
    return true;
  }
  return false;
}

function isSourceBacked(intent: CandidateIntent): boolean {
  if (intent.sourceRefs.length > 0) return true;
  if (intent.effectClass === "maintenance" || intent.effectClass === "no_effect") return true;
  return false;
}

function isRiskBlocked(intent: CandidateIntent, snapshot: ContinuitySnapshot): boolean {
  if (!snapshot.riskSuppressed) return false;
  return intent.kind === "exploration" || intent.kind === "social" || intent.kind === "outreach";
}

/**
 * Hard guard evaluation (T2.1.3): source, dedupe, cooldown, quiet bias, budget, risk, awaiting user.
 */
export function evaluateHardGuards(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot): GuardEvaluation {
  const snapshot = runtime.continuity;
  const reasons: string[] = [];

  if (!isSourceBacked(intent)) {
    reasons.push("missing_source_refs");
  }

  // v7: Affordance / breaker guard (T-V7C.C.2)
  if (
    (intent.effectClass === "connector_action" ||
      intent.effectClass === "external_platform_action") &&
    runtime.affordanceMap &&
    intent.platformId
  ) {
    const platformItems = runtime.affordanceMap[intent.platformId] ?? [];
    const match = intent.capabilityIntent
      ? platformItems.find((i: AffordanceItem) => i.capabilityId === intent.capabilityIntent)
      : platformItems.find((i: AffordanceItem) => i.intent === intent.summary);

    if (match) {
      if (match.status === "painful") {
        reasons.push("connector_circuit_open");
      } else if (match.status === "unavailable") {
        reasons.push("affordance_unavailable");
      }
    } else {
      reasons.push("affordance_unavailable");
    }
  }

  const key = intentFingerprint(intent);
  if (runtime.hardGuards.hasDuplicateIntent(key)) {
    reasons.push("duplicate_intent");
  }

  if (intent.effectClass === "user_outreach" && !runtime.hardGuards.isOutreachCooldownClear(key)) {
    reasons.push("outreach_cooldown");
  }

  if (isQuietSuppressed(intent, runtime)) {
    reasons.push("quiet_window_suppression");
  }

  if (isBudgetExceeded(intent, snapshot)) {
    reasons.push("budget_exceeded");
  }

  if (snapshot.awaitingUserInput) {
    reasons.push("awaiting_user");
  }

  if (isRiskBlocked(intent, snapshot)) {
    reasons.push("risk_suppressed");
  }

  if (reasons.length === 0) {
    return {
      verdict: "allow",
      reasons: [],
      quietSuppressed: false,
      leaseRequired:
        intent.effectClass === "external_platform_action" ||
        intent.effectClass === "connector_action" ||
        intent.effectClass === "user_outreach",
      requiresCheckpoint: intent.effectClass !== "maintenance" && intent.effectClass !== "no_effect",
    };
  }

  const duplicate = reasons.includes("duplicate_intent");
  const cooldown = reasons.includes("outreach_cooldown");
  const circuitOpen = reasons.includes("connector_circuit_open");
  const affordanceUnavailable = reasons.includes("affordance_unavailable");
  if (duplicate || cooldown || circuitOpen || affordanceUnavailable) {
    return {
      verdict: "defer",
      reasons,
      quietSuppressed: reasons.includes("quiet_window_suppression"),
      leaseRequired: false,
      requiresCheckpoint: false,
    };
  }

  const escalated = reasons.includes("awaiting_user") && intent.kind === "outreach";
  return {
    verdict: escalated ? "escalate" : "deny",
    reasons,
    quietSuppressed: reasons.includes("quiet_window_suppression"),
    leaseRequired: false,
    requiresCheckpoint: false,
  };
}

/** Continuity-only guard path for legacy call sites; builds a minimal runtime snapshot. */
export function evaluateGuards(intent: CandidateIntent, snapshot: ContinuitySnapshot): GuardEvaluation {
  const inputs = {
    mode: snapshot.mode,
    currentWindowId: snapshot.currentWindowId,
    pendingObligations: snapshot.pendingObligations,
    recentOutreachHashes: snapshot.recentOutreachHashes,
    deniedIntents: snapshot.deniedIntents,
    budgets: snapshot.budgets,
    awaitingUserInput: snapshot.awaitingUserInput,
    riskSuppressed: snapshot.riskSuppressed,
    quietEnabledBridge: snapshot.mode === "quiet",
  };
  const runtime = buildHeartbeatRuntimeSnapshot("2026-03-25T12:00:00.000Z", inputs, snapshot);
  return evaluateHardGuards(intent, runtime);
}
