/**
 * MemoryProjectionLifecycle — Manage accepted long-term memory projections.
 *
 * Core logic: Accept, activate, supersede, and reject projections.
 * When accepting a projection on a topic with existing active projection,
 * supersede the old one.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readMemoryProjectionsByTopic, writeLongTermMemoryProjection)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Only accepts projections with source refs.
 * - Supersedes old active projections on same topic automatically.
 * - Does not delete projections; only transitions status.
 *
 * Test coverage: tests/unit/dream/memory-projection-lifecycle.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface ProjectionLifecycleResult {
    projectionId: string;
    status: "accepted" | "rejected" | "superseded" | "retired";
    reason: V8ReasonCode;
    supersedesProjectionId?: string;
}
export interface AcceptMemoryProjectionOptions {
    now?: string;
}
export declare function acceptMemoryProjection(db: StateDatabase, candidateId: string, topicKey: string, memoryText: string, sourceRefs: SourceRef[], options?: AcceptMemoryProjectionOptions): Promise<ProjectionLifecycleResult | DegradedOperationResult>;
export declare function rejectMemoryProjection(db: StateDatabase, projectionId: string, _candidateId: string, _topicKey: string, _sourceRefs: SourceRef[], reason?: V8ReasonCode, options?: AcceptMemoryProjectionOptions): Promise<ProjectionLifecycleResult | DegradedOperationResult>;
export declare function retireMemoryProjection(db: StateDatabase, projectionId: string, _candidateId: string, _topicKey: string, _sourceRefs: SourceRef[], options?: AcceptMemoryProjectionOptions): Promise<ProjectionLifecycleResult | DegradedOperationResult>;
