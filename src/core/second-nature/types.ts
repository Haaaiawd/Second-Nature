export type TopLevelMode = "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";
export type IntentKind = "work" | "exploration" | "social" | "reflection" | "outreach" | "maintenance";
export type DecisionBasis = "rule_only" | "score_based" | "model_assisted";
export type GuardVerdict = "allow" | "defer" | "deny" | "escalate";

export interface ContinuitySnapshot {
  mode: TopLevelMode;
  currentWindowId: string;
  pendingObligations: string[];
  recentOutreachHashes: string[];
  deniedIntents: Array<{ intentHash: string; reason: string; at: string }>;
  budgets?: {
    socialUsed: number;
    socialLimit: number;
  };
  awaitingUserInput?: boolean;
  riskSuppressed?: boolean;
}

export interface CandidateIntent {
  id: string;
  kind: IntentKind;
  priority: number;
  source: "tick" | "interrupt" | "obligation" | "quiet_plan";
  platformId?: string;
  summary: string;
  effectClass: "external_platform_action" | "memory_curation" | "narrative_reflection" | "user_outreach" | "maintenance";
}

export interface GuardEvaluation {
  verdict: GuardVerdict;
  reasons: string[];
  quietSuppressed: boolean;
  leaseRequired: boolean;
  requiresCheckpoint: boolean;
}
