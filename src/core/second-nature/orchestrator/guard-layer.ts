import type { CandidateIntent, ContinuitySnapshot, GuardEvaluation } from "../types.js";

function stableIntentHash(intent: CandidateIntent): string {
  return `${intent.kind}:${intent.summary}`;
}

function isDuplicateIntent(intent: CandidateIntent, snapshot: ContinuitySnapshot): boolean {
  const hash = stableIntentHash(intent);
  return snapshot.deniedIntents.some((item) => item.intentHash === hash && item.reason === "duplicate_intent");
}

function isBudgetExceeded(intent: CandidateIntent, snapshot: ContinuitySnapshot): boolean {
  if (intent.kind !== "social") return false;
  if (!snapshot.budgets) return false;
  return snapshot.budgets.socialUsed >= snapshot.budgets.socialLimit;
}

function isQuietSuppressed(intent: CandidateIntent, snapshot: ContinuitySnapshot): boolean {
  if (snapshot.mode !== "quiet") return false;
  if (intent.effectClass === "maintenance" || intent.effectClass === "memory_curation" || intent.effectClass === "narrative_reflection") {
    return false;
  }
  return true;
}

export function evaluateGuards(intent: CandidateIntent, snapshot: ContinuitySnapshot): GuardEvaluation {
  const reasons: string[] = [];

  if (isDuplicateIntent(intent, snapshot)) {
    reasons.push("duplicate_intent");
  }
  if (isBudgetExceeded(intent, snapshot)) {
    reasons.push("budget_exceeded");
  }
  if (isQuietSuppressed(intent, snapshot)) {
    reasons.push("quiet_window");
  }
  if (snapshot.awaitingUserInput) {
    reasons.push("awaiting_user");
  }

  if (reasons.length === 0) {
    return {
      verdict: "allow",
      reasons,
      quietSuppressed: false,
      leaseRequired: intent.effectClass === "external_platform_action" || intent.effectClass === "user_outreach",
      requiresCheckpoint: intent.effectClass !== "maintenance",
    };
  }

  const escalated = reasons.includes("awaiting_user") && intent.kind === "outreach";
  return {
    verdict: escalated ? "escalate" : "deny",
    reasons,
    quietSuppressed: reasons.includes("quiet_window"),
    leaseRequired: false,
    requiresCheckpoint: false,
  };
}
