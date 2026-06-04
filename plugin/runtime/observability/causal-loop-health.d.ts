/**
 * CausalLoopHealth — Assemble loop health snapshot from cycle traces and stage events.
 *
 * Core logic: Read recent HeartbeatCycleTrace and LoopStageEvent rows,
 * compute stage freshness, identify stalled stages, and return
 * CausalLoopHealthSnapshot.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §3.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readHeartbeatCycleTraces, readLoopStageEventsByStage)
 * - `src/shared/types/v8-contracts.js` (LoopStage, DegradedOperationResult)
 *
 * Boundary:
 * - Does not judge action correctness; only measures loop progression.
 * - Does not block heartbeat; returns degraded diagnostics.
 * - Stall detection uses cycle-sequence gaps, not wall-clock only.
 *
 * Test coverage: tests/unit/observability/causal-loop-health.test.ts
 */
import type { StateDatabase } from "../storage/db/index.js";
import type { LoopStage, DegradedOperationResult } from "../shared/types/v8-contracts.js";
export interface StageHealth {
    stage: LoopStage;
    lastEventAt?: string;
    lastCycleSequence?: number;
    eventCount: number;
    stalled: boolean;
}
export interface CausalLoopHealthSnapshot {
    overallStatus: "healthy" | "degraded" | "stalled" | "no_data";
    stalledAt?: LoopStage;
    lastCycleSequence: number;
    lastHeartbeatAt?: string;
    stages: StageHealth[];
    reason?: string;
}
export interface AssembleLoopStatusOptions {
    stallThresholdCycles?: number;
    limit?: number;
}
export declare function assembleLoopStatus(db: StateDatabase, options?: AssembleLoopStatusOptions): Promise<CausalLoopHealthSnapshot | DegradedOperationResult>;
