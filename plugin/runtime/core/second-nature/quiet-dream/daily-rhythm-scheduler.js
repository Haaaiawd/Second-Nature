/**
 * DailyRhythmScheduler — Independent Quiet/Dream cadence with absence reasons.
 *
 * Core logic: Check if today's Quiet review is due (closures exist but no review
 * yet), schedule/run it, then check Dream status. Records durable states so
 * loop_status can report exact missing stages even when heartbeat does not
 * select a quiet intent.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.1-§3.4`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (write/read DailyRhythmState)
 * - `src/core/second-nature/quiet-dream/quiet-daily-review-builder.js`
 * - `src/core/second-nature/quiet-dream/dream-scheduler.js`
 *
 * Boundary:
 * - Does not run consolidation; only schedules and records lifecycle.
 * - Does not bypass Dream runner; only records due/completed/blocked.
 */
import { writeDailyRhythmState, readDailyRhythmStateByDay, readActionClosuresByDay, } from "../../../storage/v8-state-stores.js";
import { buildQuietDailyReview } from "./quiet-daily-review-builder.js";
import { scheduleDreamAfterQuiet } from "./dream-scheduler.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function todayString(now) {
    return now.slice(0, 10);
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function checkDailyRhythm(db, options) {
    const now = options?.now ?? new Date().toISOString();
    const day = todayString(now);
    // Read existing rhythm state
    const existing = await readDailyRhythmStateByDay(db, day);
    if (existing.degraded) {
        return existing.degraded;
    }
    const state = existing.row
        ? {
            day: existing.row.day,
            quietStatus: existing.row.quietStatus,
            dreamStatus: existing.row.dreamStatus,
            quietReason: existing.row.quietReason,
            dreamReason: existing.row.dreamReason,
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
    }
    else if (!hasClosures) {
        state.quietStatus = "not_due";
        state.quietReason = "quiet_empty_input";
    }
    else {
        // Closures exist but Quiet not completed → due
        state.quietStatus = "due";
        // Auto-run Quiet if forced or if not yet attempted
        if (options?.forceQuiet || state.quietStatus === "due") {
            const quietResult = await buildQuietDailyReview(db, { day, now });
            if (quietResult.status === "completed") {
                state.quietStatus = "completed";
                state.quietReason = "quiet_completed";
                state.quietCompletedAt = now;
            }
            else if (quietResult.status === "empty") {
                state.quietStatus = "skipped";
                state.quietReason = quietResult.reason ?? "quiet_empty_input";
            }
            else {
                // Degraded
                state.quietStatus = "blocked";
                state.quietReason = quietResult.reason ?? "state_unreadable";
            }
        }
    }
    // Determine Dream status based on Quiet outcome
    if (state.quietStatus === "completed") {
        if (state.dreamStatus === "completed" ||
            state.dreamStatus === "scheduled" ||
            state.dreamStatus === "blocked") {
            // Already handled; do not re-schedule
        }
        else {
            state.dreamStatus = "due";
            state.dreamReason = "dream_scheduled";
            // Schedule Dream
            const quietId = `quiet_${day}`;
            const dreamResult = await scheduleDreamAfterQuiet(db, quietId, {
                now,
                schedulerAvailable: options?.schedulerAvailable ?? true,
            });
            if ("reason" in dreamResult) {
                state.dreamStatus = "blocked";
                state.dreamReason = dreamResult.reason;
            }
            else if (dreamResult.status === "blocked") {
                state.dreamStatus = "blocked";
                state.dreamReason = dreamResult.reason ?? "dream_scheduler_unavailable";
            }
            else {
                state.dreamStatus = "scheduled";
                state.dreamReason = "dream_scheduled";
            }
        }
    }
    else if (state.quietStatus === "not_due") {
        state.dreamStatus = "not_due";
        state.dreamReason = "quiet_empty_input";
    }
    else if (state.quietStatus === "skipped") {
        state.dreamStatus = "blocked";
        state.dreamReason = state.quietReason ?? "quiet_empty_input";
    }
    else {
        // Quiet blocked (degraded) → Dream cannot run
        state.dreamStatus = "blocked";
        state.dreamReason = state.quietReason ?? "dream_blocked_redaction";
    }
    // Persist state
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
        payloadJson: JSON.stringify({ checkedAt: now, hasClosures: closuresRead.rows.length }),
        updatedAt: now,
    });
    if ("reason" in writeResult) {
        return writeResult;
    }
    return { status: "checked", state };
}
