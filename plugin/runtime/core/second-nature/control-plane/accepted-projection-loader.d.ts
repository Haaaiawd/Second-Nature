/**
 * AcceptedProjectionLoader — Load accepted long-term memory into EmbodiedContext.
 *
 * Core logic: Read active/accepted projections from state, exclude candidates,
 * and return bounded memory slice for heartbeat context assembly.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readMemoryProjectionsByStatus)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult)
 *
 * Boundary:
 * - Only loads accepted/active projections; candidates are excluded.
 * - Does not judge projection importance; loads all active.
 * - Degrades gracefully on unreadable state.
 *
 * Test coverage: tests/unit/control-plane/accepted-projection-loader.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { SourceRef, DegradedOperationResult } from "../../../shared/types/v8-contracts.js";
export interface MemoryProjectionSlice {
    projections: AcceptedProjection[];
    topicKeys: string[];
    totalProjections: number;
}
export interface AcceptedProjection {
    id: string;
    topicKey: string;
    memoryText: string;
    sourceRefs: SourceRef[];
    acceptedAt?: string;
}
export type LoadAcceptedProjectionsResult = {
    ok: true;
    slice: MemoryProjectionSlice;
} | {
    ok: false;
    degraded: DegradedOperationResult;
};
export declare function loadAcceptedProjections(db: StateDatabase, _options?: {
    limit?: number;
}): Promise<LoadAcceptedProjectionsResult>;
