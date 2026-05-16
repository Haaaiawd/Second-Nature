export type TopLevelMode = "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";
/** Control-plane candidate kinds; includes `quiet` for quiet-window–biased intents (L0 alignment). */
export type IntentKind = "work" | "exploration" | "social" | "quiet" | "reflection" | "outreach" | "maintenance";
export type DecisionBasis = "rule_only" | "score_based" | "model_assisted";
export type GuardVerdict = "allow" | "defer" | "deny" | "escalate";
/** Minimal source ref for planner / guards (matches state-system `SourceRef` subset). */
export interface ControlPlaneSourceRef {
    id: string;
    kind: "platform_item" | "workspace_artifact" | "decision_record" | "user_anchor" | "connector_result" | "host_report" | "fallback_artifact";
    uri: string;
    excerptHash?: string;
    observedAt?: string;
}
export interface ContinuitySnapshot {
    mode: TopLevelMode;
    currentWindowId: string;
    pendingObligations: string[];
    recentOutreachHashes: string[];
    deniedIntents: Array<{
        intentHash: string;
        reason: string;
        at: string;
    }>;
    budgets?: {
        socialUsed: number;
        socialLimit: number;
    };
    awaitingUserInput?: boolean;
    riskSuppressed?: boolean;
}
export type CandidateEffectClass = "external_platform_action" | "connector_action" | "memory_curation" | "narrative_reflection" | "user_outreach" | "maintenance" | "no_effect";
export interface CandidateIntent {
    id: string;
    kind: IntentKind;
    priority: number;
    source: "tick" | "interrupt" | "obligation" | "quiet_plan";
    platformId?: string;
    summary: string;
    effectClass: CandidateEffectClass;
    /** Required for source-backed guard; may be empty when planner expects hard-guard deny. */
    sourceRefs: ControlPlaneSourceRef[];
    /** Dedupe / cooldown key; defaults to stable fingerprint in guard layer when omitted. */
    idempotencyKey?: string;
    /** T2.1.4: IDs of accepted AgentGoals that influenced this candidate's priority. */
    goalInfluenceRefs?: string[];
    /** T2.1.4: Human-readable reasons for the priority value (goal influence, user task, rhythm). */
    priorityReasons?: string[];
}
export interface GuardEvaluation {
    verdict: GuardVerdict;
    reasons: string[];
    quietSuppressed: boolean;
    leaseRequired: boolean;
    requiresCheckpoint: boolean;
}
