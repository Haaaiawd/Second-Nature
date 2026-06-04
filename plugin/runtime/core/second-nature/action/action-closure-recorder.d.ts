/**
 * ActionClosureRecorder — Record heartbeat cycle closure outcomes.
 *
 * Core logic: Write ActionClosureRecord for no-action, completed, denied,
 * deferred, downgraded, and failed outcomes. Handles idempotent retry
 * and remember-for-review memory candidates.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeActionClosureRecord, readActionClosuresByCycle)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not execute actions; only records outcomes.
 * - Does not form long-term memory; only emits review intent.
 * - Degrades gracefully on DB failure.
 *
 * Test coverage: tests/unit/action/action-closure-recorder.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, V8ReasonCode, MemoryReviewCandidateClosure } from "../../../shared/types/v8-contracts.js";
export type ClosureStatus = "completed" | "no_action" | "denied" | "deferred" | "downgraded" | "failed";
export interface ActionClosureRecord {
    id: string;
    cycleId: string;
    proposalId?: string;
    decisionId?: string;
    idempotencyKey?: string;
    retryOfClosureId?: string;
    dispatchAttempt: number;
    closureStatus: ClosureStatus;
    inputSummary: string;
    outputSummary?: string;
    postProcessing: string[];
    nextState: string;
    reason: V8ReasonCode;
    sourceRefs: SourceRef[];
    memoryReviewCandidate?: MemoryReviewCandidateClosure;
    closedAt: string;
}
export interface RecordClosureOptions {
    now?: string;
}
export type RecordClosureResult = {
    status: "recorded";
    closureId: string;
} | {
    status: "idempotent";
    closureId: string;
} | DegradedOperationResult;
export declare function recordNoActionClosure(db: StateDatabase, cycleId: string, noActionReason: V8ReasonCode, options?: RecordClosureOptions): Promise<RecordClosureResult>;
export declare function recordRememberClosure(db: StateDatabase, cycleId: string, memoryReviewCandidate: MemoryReviewCandidateClosure, options?: RecordClosureOptions): Promise<RecordClosureResult>;
export declare function recordPolicyOutcomeClosure(db: StateDatabase, cycleId: string, closureStatus: ClosureStatus, reason: V8ReasonCode, params: {
    proposalId?: string;
    decisionId?: string;
    downgradedActionKind?: string;
    postProcessing?: string[];
    nextState?: string;
}, options?: RecordClosureOptions): Promise<RecordClosureResult>;
export declare function recordExecutionClosure(db: StateDatabase, cycleId: string, closureStatus: "completed" | "failed", reason: V8ReasonCode, params: {
    proposalId: string;
    decisionId: string;
    executionResultRef?: string;
    outputSummary?: string;
    nextState?: string;
    retryable?: boolean;
}, options?: RecordClosureOptions): Promise<RecordClosureResult>;
