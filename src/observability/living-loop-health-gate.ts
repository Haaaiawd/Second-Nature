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
import {
  readActionClosuresByDay,
  readDailyRhythmStateByDay,
  readHeartbeatCycleTraces,
} from "../storage/v8-state-stores.js";
import type { DegradedOperationResult } from "../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface RealRunHealthGate {
  /** Has at least one real ActionClosureRecord */
  hasRealClosure: boolean;
  /** Has a completed QuietDailyReview */
  hasQuietArtifact: boolean;
  /** Has a scheduled or completed DreamConsolidationRun */
  hasDreamArtifact: boolean;
  /** True if only contract smoke (cycle traces) but no real artifacts */
  contractSmokeOnly: boolean;
  /** True if closure exists but no runtime-produced cycle trace backs it */
  seededStateDetected: boolean;
  /** True only when real runtime activity is proven (not seeded, not smoke-only) */
  gatePassed: boolean;
  /** Explicit missing stage reason */
  missingStage?: "closure" | "quiet" | "dream" | "none";
  missingReason?: string;
}

export type RealRunHealthResult =
  | { ok: true; gate: RealRunHealthGate }
  | { ok: false; degraded: DegradedOperationResult };

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function checkRealRunHealth(
  db: StateDatabase,
  day?: string,
): Promise<RealRunHealthResult> {
  const targetDay = day ?? new Date().toISOString().slice(0, 10);

  // Check closures
  const closureResult = await readActionClosuresByDay(db, targetDay);
  if (closureResult.degraded) {
    return { ok: false, degraded: closureResult.degraded };
  }

  const hasRealClosure = closureResult.rows.length > 0;

  // Check if closures are runtime-produced (backed by cycle trace + stage events)
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

  // Determine if only contract smoke
  const contractSmokeOnly = !hasRealClosure && !hasQuietArtifact && !hasDreamArtifact;

  // Gate passes only when all real runtime stages have evidence
  const gatePassed = !contractSmokeOnly && !seededStateDetected && hasRealClosure && hasQuietArtifact && hasDreamArtifact;

  // Identify missing stage
  let missingStage: RealRunHealthGate["missingStage"];
  let missingReason: string | undefined;

  if (!hasRealClosure) {
    missingStage = "closure";
    missingReason = "No ActionClosureRecord for today. Heartbeat may be running contract smoke without real action closure.";
  } else if (seededStateDetected) {
    missingStage = "closure";
    missingReason = "ActionClosureRecord exists but lacks runtime-produced cycle trace. Seeded state detected — not valid runtime proof.";
  } else if (!hasQuietArtifact) {
    missingStage = "quiet";
    missingReason = "ActionClosureRecord exists but no QuietDailyReview. Daily review may be due or skipped.";
  } else if (!hasDreamArtifact) {
    missingStage = "dream";
    missingReason = "QuietDailyReview completed but no DreamConsolidationRun. Dream scheduler may be unavailable.";
  } else {
    missingStage = "none";
    missingReason = "All living-loop stages have real artifacts.";
  }

  return {
    ok: true,
    gate: {
      hasRealClosure,
      hasQuietArtifact,
      hasDreamArtifact,
      contractSmokeOnly,
      seededStateDetected,
      gatePassed,
      missingStage,
      missingReason,
    },
  };
}
