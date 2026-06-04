/**
 * DreamScheduler — Schedule Dream consolidation after Quiet completion.
 *
 * Core logic: Read a QuietDailyReview, create a DreamConsolidationRun
 * with lifecycle trace, and write it to state. Handles unavailable
 * scheduler by recording degraded state.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readQuietDailyReviewById, writeDreamConsolidationRun)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not run consolidation; only schedules and records lifecycle.
 * - Does not form long-term memory; Dream runner does that.
 * - Degrades gracefully on missing review or unreadable state.
 *
 * Test coverage: tests/unit/dream/dream-scheduler-lifecycle.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
export interface DreamScheduleResult {
    id: string;
    quietReviewId: string;
    status: "scheduled" | "started" | "completed" | "failed" | "blocked";
    reason?: V8ReasonCode;
    createdAt: string;
}
export interface ScheduleDreamAfterQuietOptions {
    now?: string;
    schedulerAvailable?: boolean;
}
export declare function scheduleDreamAfterQuiet(db: StateDatabase, quietReviewId: string, options?: ScheduleDreamAfterQuietOptions): Promise<DreamScheduleResult | DegradedOperationResult>;
