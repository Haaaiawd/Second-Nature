/**
 * ActionProposalBuilder — Convert JudgmentVerdict into ActionProposal.
 *
 * Core logic: Read a verdict, map action kind to side-effect class and
 * expected output, and write an ActionProposal row. For `remember` verdicts,
 * emit a MemoryReviewCandidateClosure instead of an executable proposal.
 * For `ignore` / `watch`, return a no-action result.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.1`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readJudgmentVerdictById, writeActionClosureRecord)
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind, SourceRef,
 *   DegradedOperationResult, V8ReasonCode, ACTION_KIND_REGISTRY)
 *
 * Boundary:
 * - Does not evaluate policy; only builds proposal payload.
 * - Does not write long-term memory on `remember`; emits review intent only.
 * - Degrades gracefully on missing verdict or unreadable state.
 *
 * Test coverage: tests/unit/action/action-proposal-builder.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, PlatformNeutralActionKind, V8ReasonCode, MemoryReviewCandidateClosure } from "../../../shared/types/v8-contracts.js";
export interface ActionProposal {
    id: string;
    cycleId: string;
    judgmentVerdictId: string;
    actionKind: PlatformNeutralActionKind;
    targetPlatformId?: string;
    targetCapabilityId?: string;
    sourceRefs: SourceRef[];
    reason: V8ReasonCode;
    riskPosture: "low" | "medium" | "high" | "blocked";
    expectedOutput: string;
    sideEffectClass: string;
    idempotencyKey: string;
    createdAt: string;
}
export interface NoActionResult {
    status: "no_action";
    reason: V8ReasonCode;
    cycleId: string;
    judgmentVerdictId: string;
}
export interface RememberForReviewResult {
    status: "remember_for_review";
    memoryReviewCandidate: MemoryReviewCandidateClosure;
    closureId: string;
}
export type BuildActionProposalResult = {
    status: "proposal";
    proposal: ActionProposal;
} | NoActionResult | RememberForReviewResult;
export interface BuildActionProposalOptions {
    now?: string;
}
export declare function buildActionProposal(db: StateDatabase, judgmentVerdictId: string, options?: BuildActionProposalOptions): Promise<BuildActionProposalResult | DegradedOperationResult>;
export interface BatchBuildProposalResult {
    proposals: ActionProposal[];
    noActions: NoActionResult[];
    rememberForReviews: RememberForReviewResult[];
    failed: {
        judgmentVerdictId: string;
        degraded: DegradedOperationResult;
    }[];
}
export declare function buildActionProposals(db: StateDatabase, judgmentVerdictIds: string[], options?: BuildActionProposalOptions): Promise<BatchBuildProposalResult>;
