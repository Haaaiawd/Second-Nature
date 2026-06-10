/**
 * JudgmentEngine — Produce JudgmentVerdict records from PerceptionCard.
 *
 * Core logic: Read a PerceptionCard, apply rules-only decision tree, and
 * write a source-backed JudgmentVerdict. No model assist; deterministic
 * verdict based on relevance, risk flags, source refs, and confidence.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readPerceptionCardById, writeJudgmentVerdict)
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind, SourceRef,
 *   DegradedOperationResult, V8ReasonCode, ACTION_KIND_REGISTRY)
 *
 * Boundary:
 * - Does not execute actions; produces verdict only.
 * - Does not write long-term memory; only emits review intent.
 * - Degrades gracefully on missing card or unreadable state.
 *
 * Test coverage: tests/unit/judgment/judgment-engine.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, PlatformNeutralActionKind, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
import type { AcceptedProjection } from "../control-plane/accepted-projection-loader.js";
export interface JudgmentVerdictResult {
    id: string;
    cycleId: string;
    perceptionCardId: string;
    actionKind: PlatformNeutralActionKind;
    confidence: number;
    reason: V8ReasonCode;
    riskPosture: "low" | "medium" | "high" | "blocked";
    sourceRefs: SourceRef[];
    createdAt: string;
}
export interface RunAgentJudgmentResult {
    status: "completed" | "blocked" | "degraded";
    verdicts: JudgmentVerdictResult[];
    reason?: V8ReasonCode;
}
export interface RunAgentJudgmentOptions {
    now?: string;
    acceptedProjections?: AcceptedProjection[];
}
export declare function runAgentJudgment(db: StateDatabase, perceptionCardId: string, options?: RunAgentJudgmentOptions): Promise<RunAgentJudgmentResult | DegradedOperationResult>;
export interface BatchJudgmentResult {
    succeeded: JudgmentVerdictResult[];
    failed: {
        perceptionCardId: string;
        degraded: DegradedOperationResult;
    }[];
}
export declare function runAgentJudgments(db: StateDatabase, perceptionCardIds: string[], options?: RunAgentJudgmentOptions): Promise<BatchJudgmentResult>;
