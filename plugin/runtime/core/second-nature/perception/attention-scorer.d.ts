/**
 * AttentionScorer — Rules-first scoring for v9 AttentionSignal.
 *
 * Core logic: Compute novelty, relevance, risk, possible actions, and
 * ActivityThread suggestions from evidence + context. No LLM is used for
 * scoring; all outputs are deterministic and contestable.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §1.1 §3.2-§3.5a`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (RepetitionKind, AttentionActionKind, SourceRef, ActivityThread)
 *
 * Boundary:
 * - Does not make final judgments.
 * - Does not mutate ActivityThread state.
 *
 * Test coverage: tests/unit/attention/v9-attention-assembler.test.ts
 */
import type { RepetitionKind, AttentionActionKind, ActivityThread, EvidenceItem } from "../../../shared/types/v9-contracts.js";
import type { StableEvidenceIdentity } from "../../../storage/v9-evidence-identity-port.js";
export declare const NOVELTY_DUPLICATE = 0;
export declare const NOVELTY_CHANGED = 0.5;
export declare const NOVELTY_NEW = 1;
export declare const RELEVANCE_HIGH = 0.8;
export declare const RELEVANCE_MEDIUM = 0.5;
export declare const RELEVANCE_LOW = 0.2;
export declare const ATTENTION_SUMMARY_MAX_CHARS = 280;
export declare const POSSIBLE_ACTIONS_MAX_COUNT = 4;
export declare const ACTION_RATIONALE_MAX_CHARS = 120;
export declare const ACTIVITY_THREAD_MAX_STEPS = 8;
export declare const ACTIVITY_THREAD_STALE_HEARTBEATS = 3;
export type SensitivityHint = "public_technical" | "public_general" | "private_context" | "sensitive";
export interface AttentionContextGoal {
    text: string;
    tags?: string[];
}
export interface AttentionContextProjection {
    topic?: string;
    tags?: string[];
}
export interface AttentionContextBodyIntuition {
    recentPlatforms: string[];
}
export interface AttentionContextRoutine {
    routineId: string;
    capabilityPattern: string;
}
export interface AttentionContext {
    acceptedGoals: AttentionContextGoal[];
    activeProjections: AttentionContextProjection[];
    bodyIntuition: AttentionContextBodyIntuition;
    routineRegistry: AttentionContextRoutine[];
    activeActivityThreads: ActivityThread[];
    cycleSequence: number;
}
export interface RichEvidenceItem extends EvidenceItem {
    id: string;
    capabilityId: string;
    summary?: string;
    sensitivityHint?: SensitivityHint;
    tags?: string[];
}
export declare function scoreNovelty(repetitionStatus: RepetitionKind): number;
export declare function scoreRelevance(evidence: RichEvidenceItem, ctx: AttentionContext): number;
export declare function scoreRisk(evidence: RichEvidenceItem): "none" | "low" | "medium" | "high";
export declare function suggestActions(evidence: RichEvidenceItem, identity: StableEvidenceIdentity, ctx: AttentionContext): AttentionActionKind[];
export declare function suggestActivityThread(evidence: RichEvidenceItem, identity: StableEvidenceIdentity, ctx: AttentionContext): {
    threadSuggestion: "create" | "continue" | "pause" | "complete" | "none";
    activityThreadId?: string;
    reason?: string;
};
export declare function generateSummary(evidence: RichEvidenceItem, identity: StableEvidenceIdentity, relevance: number, risk: "none" | "low" | "medium" | "high"): string;
