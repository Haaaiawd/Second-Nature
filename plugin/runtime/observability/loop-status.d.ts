/**
 * LoopStatus — Expose loop health and stalled stage diagnostics.
 *
 * Core logic: Call assembleLoopStatus, format into v8 loop_status shape,
 * and include policy-denied closure counts.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md`
 *
 * Dependencies:
 * - `src/observability/causal-loop-health.js` (assembleLoopStatus)
 * - `src/storage/v8-state-stores.js` (readLoopStageEventsByStage)
 *
 * Boundary:
 * - Read-only diagnostic query; does not modify state.
 * - Returns degraded envelope when state unreadable.
 *
 * Test coverage: tests/unit/observability/loop-status.test.ts
 */
import type { StateDatabase } from "../storage/db/index.js";
import type { DegradedOperationResult } from "../shared/types/v8-contracts.js";
export interface RealRunHealthProjection {
    gatePassed: boolean;
    contractSmokeOnly: boolean;
    seededStateDetected: boolean;
    hasRealClosure: boolean;
    hasQuietArtifact: boolean;
    hasDreamArtifact: boolean;
    missingStage?: string;
    missingReason?: string;
}
export interface LoopStatusReadModel {
    ok: true;
    overallStatus: string;
    stalledAt?: string;
    lastCycleSequence: number;
    lastHeartbeatAt?: string;
    stageSummaries: StageSummary[];
    policyDeniedCount: number;
    nextAction: string;
    realRunHealth: RealRunHealthProjection;
}
export interface StageSummary {
    stage: string;
    eventCount: number;
    stalled: boolean;
    lastEventAt?: string;
}
export type LoopStatusResult = {
    ok: true;
    status: LoopStatusReadModel;
} | {
    ok: false;
    degraded: DegradedOperationResult;
};
export declare function readLoopStatus(db: StateDatabase): Promise<LoopStatusResult>;
