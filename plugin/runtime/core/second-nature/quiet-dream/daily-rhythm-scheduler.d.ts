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
import type { StateDatabase } from "../../../storage/db/index.js";
import type { DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
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
export type CheckDailyRhythmResult = {
    status: "checked";
    state: DailyRhythmState;
} | DegradedOperationResult;
export declare function checkDailyRhythm(db: StateDatabase, options?: CheckDailyRhythmOptions): Promise<CheckDailyRhythmResult>;
