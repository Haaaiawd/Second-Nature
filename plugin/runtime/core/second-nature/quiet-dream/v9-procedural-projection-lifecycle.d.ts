/**
 * ProceduralProjectionLifecycle — Manage accepted procedural projection candidates.
 *
 * Core logic: Accept, reject, or retire capability-pattern routines that emerge
 * from Quiet/Dream consolidation. Accepting a candidate on a capability pattern
 * that already has an active projection supersedes the old one.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3`
 *
 * Dependencies:
 * - `src/storage/v9-state-stores.js` (readProceduralProjectionsByCapabilityPattern,
 *   writeProceduralProjection, updateProceduralProjectionStatus)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Only accepts candidates with source refs and a capability pattern.
 * - Supersedes old active projections on the same capability pattern automatically.
 * - Does not delete projections; only transitions status.
 *
 * Test coverage: tests/unit/dream/v9-procedural-projection-lifecycle.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, V9ReasonCode } from "../../../shared/types/v9-contracts.js";
import type { DegradedOperationResult } from "../../../shared/types/v8-contracts.js";
export interface ProceduralProjectionLifecycleResult {
    projectionId: string;
    status: "accepted" | "rejected" | "superseded" | "retired";
    reason: V9ReasonCode;
    supersedesProjectionId?: string;
}
export interface AcceptProceduralProjectionOptions {
    now?: string;
    payloadJson?: string;
}
export declare function acceptProceduralProjection(db: StateDatabase, candidateId: string, capabilityPattern: string, routineText: string, sourceRefs: SourceRef[], options?: AcceptProceduralProjectionOptions): Promise<ProceduralProjectionLifecycleResult | DegradedOperationResult>;
export declare function rejectProceduralProjection(db: StateDatabase, projectionId: string): Promise<ProceduralProjectionLifecycleResult | DegradedOperationResult>;
export declare function retireProceduralProjection(db: StateDatabase, projectionId: string): Promise<ProceduralProjectionLifecycleResult | DegradedOperationResult>;
