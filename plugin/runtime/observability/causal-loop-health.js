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
import { readHeartbeatCycleTraces, readLoopStageEventsByStage, } from "../storage/v8-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const DEFAULT_STALL_THRESHOLD_CYCLES = 2;
const LOOP_STAGES = [
    "ingestion",
    "perception",
    "judgment",
    "policy",
    "execution",
    "closure",
    "quiet",
    "dream",
    "projection",
];
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function maxCycleSequence(stages) {
    return Math.max(0, ...stages.map((s) => s.lastCycleSequence ?? 0));
}
function findStalledStage(stages, threshold) {
    const maxSeq = maxCycleSequence(stages);
    if (maxSeq === 0)
        return undefined;
    for (const stage of stages) {
        if (stage.lastCycleSequence === undefined) {
            // No events for this stage → stalled if other stages have progressed
            if (maxSeq > 0)
                return stage.stage;
            continue;
        }
        const gap = maxSeq - stage.lastCycleSequence;
        if (gap >= threshold) {
            return stage.stage;
        }
    }
    return undefined;
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function assembleLoopStatus(db, options) {
    const threshold = options?.stallThresholdCycles ?? DEFAULT_STALL_THRESHOLD_CYCLES;
    const limit = options?.limit ?? 100;
    const cycleResult = await readHeartbeatCycleTraces(db, limit);
    if (cycleResult.degraded) {
        return cycleResult.degraded;
    }
    const cycles = cycleResult.rows;
    if (cycles.length === 0) {
        return {
            overallStatus: "no_data",
            lastCycleSequence: 0,
            stages: [],
            reason: "no heartbeat cycles recorded",
        };
    }
    const lastCycle = cycles[0];
    // Gather stage health
    const stages = [];
    for (const stage of LOOP_STAGES) {
        const eventResult = await readLoopStageEventsByStage(db, stage, limit);
        if (eventResult.degraded) {
            return eventResult.degraded;
        }
        const events = eventResult.rows;
        const lastEvent = events[0];
        stages.push({
            stage,
            lastEventAt: lastEvent?.occurredAt ?? undefined,
            lastCycleSequence: lastEvent?.cycleSequence ?? undefined,
            eventCount: events.length,
            stalled: false, // computed below
        });
    }
    const stalledAt = findStalledStage(stages, threshold);
    // Mark stalled stages
    for (const stage of stages) {
        if (stalledAt === stage.stage) {
            stage.stalled = true;
        }
    }
    const overallStatus = stalledAt
        ? "stalled"
        : "healthy";
    return {
        overallStatus,
        stalledAt,
        lastCycleSequence: lastCycle.cycleSequence,
        lastHeartbeatAt: lastCycle.heartbeatStartedAt,
        stages,
        reason: stalledAt ? `stage ${stalledAt} stalled for >=${threshold} cycles` : undefined,
    };
}
