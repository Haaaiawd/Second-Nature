/**
 * LivingLoopHealthGate — Distinguish contract-smoke from real runtime activity.
 *
 * Core logic: Check for persisted ActionClosureRecord, QuietDailyReview,
 * and DreamConsolidationRun to determine if the living loop has real
 * evidence or is only passing contract smoke tests.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §4.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §4`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readActionClosuresByDay, readDailyRhythmStateByDay)
 *
 * Boundary:
 * - Read-only diagnostic; does not modify state.
 * - Reports explicit absence reasons instead of silent zeros.
 */
import type { StateDatabase } from "../storage/db/index.js";
import type { DegradedOperationResult } from "../shared/types/v8-contracts.js";
export interface RealRunHealthGate {
    /** Has at least one real ActionClosureRecord */
    hasRealClosure: boolean;
    /** Has a completed QuietDailyReview */
    hasQuietArtifact: boolean;
    /** Has a scheduled or completed DreamConsolidationRun */
    hasDreamArtifact: boolean;
    /** Has a fresh impulse context artifact (within 24h) */
    hasFreshImpulseContext: boolean;
    /** Has at least one accepted or active long-term memory projection */
    hasProjectionFeedback: boolean;
    /** True if only contract smoke (cycle traces) but no real artifacts */
    contractSmokeOnly: boolean;
    /** True if closure exists but no runtime-produced cycle trace + stage event backs it */
    seededStateDetected: boolean;
    /** True only when real runtime activity is proven (not seeded, not smoke-only) */
    gatePassed: boolean;
    /** Explicit missing stage reason */
    missingStage?: "closure" | "quiet" | "dream" | "impulse" | "projection" | "none";
    missingReason?: string;
}
export type RealRunHealthResult = {
    ok: true;
    gate: RealRunHealthGate;
} | {
    ok: false;
    degraded: DegradedOperationResult;
};
export declare function checkRealRunHealth(db: StateDatabase, day?: string): Promise<RealRunHealthResult>;
