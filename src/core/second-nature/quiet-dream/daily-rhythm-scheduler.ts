/**
 * DailyRhythmScheduler — Independent Quiet/Dream cadence with absence reasons.
 *
 * Core logic: Check if today's Quiet review is due (closures exist but no review
 * yet), schedule/run it, then check Dream status. Records durable states so
 * loop_status can report exact missing stages even when heartbeat does not
 * select a quiet intent. Also executes stale Dream consolidation runs that
 * were left at "scheduled" because no runner picked them up.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.1-§3.4`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (write/read DailyRhythmState, readDreamConsolidationRunById, writeDreamConsolidationRun)
 * - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.js`
 * - `src/core/second-nature/quiet-dream/dream-scheduler.js`
 * - `src/core/second-nature/quiet-dream/dream-consolidation-runner.js`
 *
 * Boundary:
 * - Schedules and records lifecycle; additionally executes stale scheduled runs
 *   so `dreamStatus` reaches completed/blocked.
 * - Does not bypass Dream runner; only records due/completed/blocked.
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  writeDailyRhythmState,
  readDailyRhythmStateByDay,
  readActionClosuresByDay,
  readDreamConsolidationRunById,
  readDreamConsolidationRunsByQuietId,
  readLatestDreamConsolidationRunByStatus,
  updateDreamConsolidationRunStatus,
  writeDreamConsolidationRun,
} from "../../../storage/v8-state-stores.js";
import type { DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
import { buildQuietDailyReview } from "./quiet-daily-review-builder.js";
import { scheduleDreamAfterQuiet } from "./dream-scheduler.js";
import { runDreamConsolidation } from "./dream-consolidation-runner.js";
import { acceptMemoryProjection } from "./memory-projection-lifecycle.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type RhythmStatus = "due" | "completed" | "scheduled" | "skipped" | "blocked" | "not_due";

export interface DailyRhythmState {
  day: string;
  quietStatus: RhythmStatus;
  dreamStatus: RhythmStatus;
  quietReason?: V8ReasonCode;
  dreamReason?: V8ReasonCode;
  quietCompletedAt?: string;
  dreamCompletedAt?: string;
}

export interface CheckDailyRhythmOptions {
  now?: string;
  forceQuiet?: boolean;
  schedulerAvailable?: boolean;
}

export type CheckDailyRhythmResult =
  | { status: "checked"; state: DailyRhythmState }
  | DegradedOperationResult;

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const DREAM_DEFAULT_INTERVAL_DAYS = 7;
const STALE_SCHEDULED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function todayString(now: string): string {
  return now.slice(0, 10);
}

function parsePayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isWithinDays(isoDate: string, now: string, days: number): boolean {
  const then = new Date(isoDate).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(then) || Number.isNaN(current)) return false;
  return current - then < days * 24 * 60 * 60 * 1000;
}

function isStaleScheduled(run: { createdAt: string }, now: string): boolean {
  const created = new Date(run.createdAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(created) || Number.isNaN(current)) return false;
  return current - created > STALE_SCHEDULED_THRESHOLD_MS;
}

async function loadLatestDreamRunForQuiet(
  db: StateDatabase,
  quietId: string,
): Promise<{ row?: { id: string; status: string; createdAt: string; reason: string | null }; degraded?: DegradedOperationResult }> {
  const runsRead = await readDreamConsolidationRunsByQuietId(db, quietId);
  if (runsRead.degraded) {
    return { degraded: runsRead.degraded };
  }
  return { row: runsRead.rows[0] };
}

async function executeStaleScheduledDreams(
  db: StateDatabase,
  state: DailyRhythmState,
  now: string,
): Promise<{ completed: boolean; reason?: V8ReasonCode } | DegradedOperationResult> {
  // Look for any scheduled dream runs for today and execute them.
  const quietId = `quiet_${state.day}`;
  const knownRunIds: string[] = [];

  // Direct lookup by quiet review id is more reliable than rhythm payload cache.
  const runsRead = await readDreamConsolidationRunsByQuietId(db, quietId);
  if (runsRead.degraded) {
    return runsRead.degraded;
  }
  for (const run of runsRead.rows) {
    knownRunIds.push(run.id);
  }

  // Also read the rhythm payload for any ids that may have been recorded before.
  const rhythmRead = await readDailyRhythmStateByDay(db, state.day);
  if (!rhythmRead.degraded && rhythmRead.row?.payloadJson) {
    const payload = parsePayloadJson(rhythmRead.row.payloadJson);
    if (payload.dreamRunId) {
      knownRunIds.push(String(payload.dreamRunId));
    }
    if (Array.isArray(payload.dreamRunIds)) {
      knownRunIds.push(...(payload.dreamRunIds as string[]));
    }
  }

  const uniqueRunIds = [...new Set(knownRunIds)];
  if (uniqueRunIds.length === 0) {
    return { completed: false };
  }

  let lastResult: { completed: boolean; reason?: V8ReasonCode } = { completed: false };
  for (const runId of uniqueRunIds) {
    const runRead = await readDreamConsolidationRunById(db, runId);
    if (runRead.degraded) {
      return runRead.degraded;
    }
    const run = runRead.row;
    if (!run) continue;

    if ((run.status === "scheduled" || run.status === "started") && isStaleScheduled(run, now)) {
      const consolidateResult = await runDreamConsolidation(db, runId, { now });
          if ("status" in consolidateResult && !("ownerStage" in consolidateResult)) {
        const dreamResult = consolidateResult as Extract<typeof consolidateResult, { status: "completed" | "failed" | "blocked" }>;
        const finalStatus = dreamResult.status;
        const finalReason = dreamResult.reason ?? undefined;

        const updateResult = await updateDreamConsolidationRunStatus(db, runId, finalStatus, {
          reason: finalReason ?? null,
          payloadJson: JSON.stringify({
            ...parsePayloadJson(run.payloadJson),
            consolidatedAt: now,
            candidateCount: dreamResult.candidates.length,
            staleRepairedAt: now,
          }),
        });
        if ("reason" in updateResult) {
          return updateResult;
        }

        // T-DQ.R.10: Accept valid candidates as long-term memory projections.
        // This step was moved out of the runner to separate candidate generation
        // from acceptance, per design §4.2.
        if (dreamResult.status === "completed") {
          for (const candidate of dreamResult.candidates.filter((c) => c.validationStatus === "valid")) {
            const acceptResult = await acceptMemoryProjection(
              db,
              candidate.id,
              `topic_stale_${runId}`,
              candidate.candidateText,
              candidate.sourceRefs,
              { now },
            );
            if ("projectionId" in acceptResult) {
              candidate.acceptedProjectionId = acceptResult.projectionId;
            } else {
              return acceptResult as DegradedOperationResult;
            }
          }
        }

        lastResult = { completed: true, reason: finalReason ?? "dream_scheduled_stalled" };
      } else {
        const degraded = consolidateResult as DegradedOperationResult;
        return degraded;
      }
    } else if (run.status === "completed") {
      lastResult = { completed: true, reason: (run.reason as V8ReasonCode) ?? undefined };
    }
  }

  return lastResult;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function checkDailyRhythm(
  db: StateDatabase,
  options?: CheckDailyRhythmOptions,
): Promise<CheckDailyRhythmResult> {
  const now = options?.now ?? new Date().toISOString();
  const day = todayString(now);

  // Read existing rhythm state
  const existing = await readDailyRhythmStateByDay(db, day);
  if (existing.degraded) {
    return existing.degraded;
  }

  const state: DailyRhythmState = existing.row
    ? {
        day: existing.row.day,
        quietStatus: existing.row.quietStatus as RhythmStatus,
        dreamStatus: existing.row.dreamStatus as RhythmStatus,
        quietReason: existing.row.quietReason as V8ReasonCode | undefined,
        dreamReason: existing.row.dreamReason as V8ReasonCode | undefined,
        quietCompletedAt: existing.row.quietCompletedAt ?? undefined,
        dreamCompletedAt: existing.row.dreamCompletedAt ?? undefined,
      }
    : {
        day,
        quietStatus: "not_due",
        dreamStatus: "not_due",
      };

  // Check if closures exist for today
  const closuresRead = await readActionClosuresByDay(db, day);
  if (closuresRead.degraded) {
    return closuresRead.degraded;
  }

  const hasClosures = closuresRead.rows.length > 0;

  // Determine Quiet status
  if (state.quietStatus === "completed" || state.quietStatus === "blocked") {
    // Already handled; don't re-run
  } else if (!hasClosures) {
    state.quietStatus = "not_due";
    state.quietReason = "quiet_empty_input";
  } else {
    // Closures exist but Quiet not completed → due
    state.quietStatus = "due";

    // Auto-run Quiet if forced or if not yet attempted
    if (options?.forceQuiet || state.quietStatus === "due") {
      const quietResult = await buildQuietDailyReview(db, { day, now });

      if (quietResult.status === "completed") {
        state.quietStatus = "completed";
        state.quietReason = "quiet_completed";
        state.quietCompletedAt = now;
      } else if (quietResult.status === "empty") {
        state.quietStatus = "skipped";
        state.quietReason = quietResult.reason ?? "quiet_empty_input";
      } else {
        // Degraded
        state.quietStatus = "blocked";
        state.quietReason = quietResult.reason ?? "state_unreadable";
      }
    }
  }

  // Track scheduled dream run ids across attempts
  const dreamRunIds: string[] = [];

  // Determine Dream status based on Quiet outcome
  if (state.quietStatus === "completed") {
    if (state.dreamStatus === "completed") {
      // Already completed; nothing to do
    } else if (state.dreamStatus === "scheduled") {
      // Stale scheduled run: try to execute consolidation now
      const staleResult = await executeStaleScheduledDreams(db, state, now);
      if ("status" in staleResult) {
        return staleResult as DegradedOperationResult;
      }
      const { completed, reason } = staleResult as { completed: boolean; reason?: V8ReasonCode };
      if (completed) {
        state.dreamStatus = "completed";
        state.dreamReason = reason ?? "dream_completed";
        state.dreamCompletedAt = now;
      } else {
        // Still cannot locate/run scheduled dream; remain scheduled
        state.dreamReason = state.dreamReason ?? "dream_scheduled";
      }
    } else if (state.dreamStatus === "blocked") {
      // Already handled; do not re-schedule
    } else {
      // Global 7-day interval check: look across all quiet reviews, not just today's.
      const quietId = `quiet_${day}`;
      const globalLatest = await readLatestDreamConsolidationRunByStatus(db, ["completed", "blocked"]);
      if (globalLatest.degraded) {
        return globalLatest.degraded;
      }

      if (
        globalLatest.row &&
        isWithinDays(globalLatest.row.createdAt, now, DREAM_DEFAULT_INTERVAL_DAYS)
      ) {
        state.dreamStatus = globalLatest.row.status as RhythmStatus;
        state.dreamReason = "dream_interval_active";
        if (globalLatest.row.status === "completed") {
          state.dreamCompletedAt = now;
        }
      } else {
        state.dreamStatus = "due";
        state.dreamReason = "dream_scheduled";

        // Schedule Dream
        const dreamResult = await scheduleDreamAfterQuiet(db, quietId, {
          now,
          schedulerAvailable: options?.schedulerAvailable ?? true,
        });

        if ("reason" in dreamResult) {
          state.dreamStatus = "blocked";
          state.dreamReason = dreamResult.reason;
        } else if (dreamResult.status === "blocked") {
          state.dreamStatus = "blocked";
          state.dreamReason = dreamResult.reason ?? "dream_scheduler_unavailable";
        } else {
          state.dreamStatus = "scheduled";
          state.dreamReason = "dream_scheduled";
          dreamRunIds.push(dreamResult.id);
          // Immediately execute the freshly scheduled dream so it does not sit
          // pending forever (T-DQ.R.7).
          const consolidateResult = await runDreamConsolidation(db, dreamResult.id, { now });
      if ("status" in consolidateResult && !("ownerStage" in consolidateResult)) {
            const dreamOutcome = consolidateResult as Extract<typeof consolidateResult, { status: "completed" | "failed" | "blocked" }>;
            const updateResult = await updateDreamConsolidationRunStatus(db, dreamResult.id, dreamOutcome.status, {
              reason: dreamOutcome.reason ?? null,
              payloadJson: JSON.stringify({
                consolidatedAt: now,
                candidateCount: dreamOutcome.candidates.length,
              }),
            });
            if ("reason" in updateResult) {
              return updateResult;
            }
            state.dreamStatus = dreamOutcome.status === "completed" ? "completed" : "blocked";
            state.dreamReason = dreamOutcome.reason ?? (dreamOutcome.status === "completed" ? "dream_completed" : "dream_failed");
            if (dreamOutcome.status === "completed") {
              state.dreamCompletedAt = now;
              // T-DQ.R.10: Accept valid candidates as long-term memory projections.
              // This step was moved out of the runner to separate candidate generation
              // from acceptance, per design §4.2.
              for (const candidate of dreamOutcome.candidates.filter((c) => c.validationStatus === "valid")) {
                const acceptResult = await acceptMemoryProjection(
                  db,
                  candidate.id,
                  `topic_${dreamResult.id}`,
                  candidate.candidateText,
                  candidate.sourceRefs,
                  { now },
                );
                if ("projectionId" in acceptResult) {
                  candidate.acceptedProjectionId = acceptResult.projectionId;
                } else {
                  return acceptResult as DegradedOperationResult;
                }
              }
            }
          } else {
            const degraded = consolidateResult as DegradedOperationResult;
            return degraded;
          }
        }
      }
    }
  } else if (state.quietStatus === "not_due") {
    state.dreamStatus = "not_due";
    state.dreamReason = "quiet_empty_input";
  } else if (state.quietStatus === "skipped") {
    state.dreamStatus = "blocked";
    state.dreamReason = state.quietReason ?? "quiet_empty_input";
  } else {
    // Quiet blocked (degraded) → Dream cannot run
    state.dreamStatus = "blocked";
    state.dreamReason = state.quietReason ?? "dream_blocked_redaction";
  }

  // Persist state
  const payload: Record<string, unknown> = { checkedAt: now, hasClosures: closuresRead.rows.length };
  if (dreamRunIds.length > 0) {
    payload.dreamRunId = dreamRunIds[0];
    payload.dreamRunIds = dreamRunIds;
  }

  const writeResult = await writeDailyRhythmState(db, {
    id: `rhythm_${day}`,
    day,
    quietStatus: state.quietStatus,
    dreamStatus: state.dreamStatus,
    quietReason: state.quietReason ?? null,
    dreamReason: state.dreamReason ?? null,
    quietCompletedAt: state.quietCompletedAt ?? null,
    dreamCompletedAt: state.dreamCompletedAt ?? null,
    sourceRefs: [
      {
        uri: `sn://rhythm/${day}`,
        family: "dream_run",
        id: `rhythm_${day}`,
        redactionClass: "none",
        resolveStatus: "resolvable",
      },
    ],
    payloadJson: JSON.stringify(payload),
    updatedAt: now,
  });

  if ("reason" in writeResult) {
    return writeResult;
  }

  return { status: "checked", state };
}
