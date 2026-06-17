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
import { readActionClosuresByDay, readDailyRhythmStateByDay, readHeartbeatCycleTraces, readLoopStageEventsByCycle, readImpulseContextArtifact, readMemoryProjectionsByStatus, } from "../storage/v8-state-stores.js";
import { parseSourceRefs } from "../shared/serialization.js";
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function checkRealRunHealth(db, day) {
    const targetDay = day ?? new Date().toISOString().slice(0, 10);
    // Check closures
    const closureResult = await readActionClosuresByDay(db, targetDay);
    if (closureResult.degraded) {
        return { ok: false, degraded: closureResult.degraded };
    }
    const hasRealClosure = closureResult.rows.length > 0;
    // Check if closures are runtime-produced (backed by cycle trace + closure stage event + source refs)
    let seededStateDetected = false;
    if (hasRealClosure) {
        const traces = await readHeartbeatCycleTraces(db, 1000);
        if (traces.degraded) {
            return { ok: false, degraded: traces.degraded };
        }
        for (const closure of closureResult.rows) {
            const hasCycleTrace = traces.rows.some((t) => t.id === closure.cycleId);
            if (!hasCycleTrace) {
                seededStateDetected = true;
                break;
            }
            // F3: verify closure has corresponding loop_stage_event with stage="closure" and status="completed"
            const stageEvents = await readLoopStageEventsByCycle(db, closure.cycleId);
            if (stageEvents.degraded) {
                return { ok: false, degraded: stageEvents.degraded };
            }
            const hasClosureStageEvent = stageEvents.rows.some((e) => e.stage === "closure" && e.status === "completed");
            if (!hasClosureStageEvent) {
                seededStateDetected = true;
                break;
            }
            // F3: verify closure has non-empty source refs
            const sourceRefs = parseSourceRefs(closure.sourceRefsJson);
            if (!Array.isArray(sourceRefs) || sourceRefs.length === 0) {
                seededStateDetected = true;
                break;
            }
        }
    }
    // Check daily rhythm state for Quiet/Dream
    const rhythmResult = await readDailyRhythmStateByDay(db, targetDay);
    if (rhythmResult.degraded) {
        return { ok: false, degraded: rhythmResult.degraded };
    }
    const rhythm = rhythmResult.row;
    const hasQuietArtifact = rhythm?.quietStatus === "completed";
    const hasDreamArtifact = rhythm?.dreamStatus === "scheduled" || rhythm?.dreamStatus === "completed";
    // Check impulse context artifact freshness
    const impulseResult = await readImpulseContextArtifact(db, "heartbeat");
    let hasFreshImpulseContext = false;
    if (!impulseResult.degraded && impulseResult.row) {
        const updatedAt = new Date(impulseResult.row.updatedAt).getTime();
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        hasFreshImpulseContext = now - updatedAt <= ONE_DAY_MS;
    }
    // Check accepted/active memory projections
    const activeProjections = await readMemoryProjectionsByStatus(db, "active");
    const acceptedProjections = await readMemoryProjectionsByStatus(db, "accepted");
    const hasProjectionFeedback = (!activeProjections.degraded && activeProjections.rows.length > 0) ||
        (!acceptedProjections.degraded && acceptedProjections.rows.length > 0);
    // Determine if only contract smoke
    const contractSmokeOnly = !hasRealClosure && !hasQuietArtifact && !hasDreamArtifact && !hasFreshImpulseContext && !hasProjectionFeedback;
    // Gate passes only when all real runtime stages have evidence
    const gatePassed = !contractSmokeOnly && !seededStateDetected && hasRealClosure && hasQuietArtifact && hasDreamArtifact && hasFreshImpulseContext && hasProjectionFeedback;
    // Identify missing stage
    let missingStage;
    let missingReason;
    if (!hasRealClosure) {
        missingStage = "closure";
        missingReason = "No ActionClosureRecord for today. Heartbeat may be running contract smoke without real action closure.";
    }
    else if (seededStateDetected) {
        missingStage = "closure";
        missingReason = "ActionClosureRecord exists but lacks runtime-produced cycle trace, closure stage event, or source refs. Seeded state detected — not valid runtime proof.";
    }
    else if (!hasQuietArtifact) {
        missingStage = "quiet";
        missingReason = "ActionClosureRecord exists but no QuietDailyReview. Daily review may be due or skipped.";
    }
    else if (!hasDreamArtifact) {
        missingStage = "dream";
        missingReason = "QuietDailyReview completed but no DreamConsolidationRun. Dream scheduler may be unavailable.";
    }
    else if (!hasFreshImpulseContext) {
        missingStage = "impulse";
        missingReason = "Heartbeat produces closure but impulse context artifact is missing or stale (>24h). Run guidance_payload to refresh.";
    }
    else if (!hasProjectionFeedback) {
        missingStage = "projection";
        missingReason = "Living loop active but no accepted/active memory projections. Quiet/Dream may not have produced accepted memory yet.";
    }
    else {
        missingStage = "none";
        missingReason = "All living-loop stages have real artifacts.";
    }
    return {
        ok: true,
        gate: {
            hasRealClosure,
            hasQuietArtifact,
            hasDreamArtifact,
            hasFreshImpulseContext,
            hasProjectionFeedback,
            contractSmokeOnly,
            seededStateDetected,
            gatePassed,
            missingStage,
            missingReason,
        },
    };
}
