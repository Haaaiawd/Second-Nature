/**
 * LoopStageEventSink — v8 observability stage event recorder.
 *
 * Core logic: Validate, redact, and append LoopStageEvent rows.
 * Malformed events produce degraded diagnostics without blocking the
 * heartbeat main loop.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §3.1`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeLoopStageEvent)
 * - `src/shared/types/v8-contracts.js` (LoopStageEvent, SourceRef, V8ReasonCode)
 *
 * Boundary:
 * - Does NOT make semantic decisions about stage health.
 * - Does NOT block callers on DB failure; returns degraded result.
 * - Redacts credential-shaped values before persistence.
 *
 * Test coverage: tests/unit/observability/loop-stage-event-sink.test.ts
 */
import type { StateDatabase } from "../storage/db/index.js";
import type { LoopStageEvent, DegradedOperationResult } from "../shared/types/v8-contracts.js";
export interface RecordLoopStageEventOptions {
    now?: string;
}
export type RecordLoopStageEventResult = {
    ok: true;
    id: string;
} | {
    ok: false;
    degraded: DegradedOperationResult;
};
export declare function recordLoopStageEvent(db: StateDatabase, event: Partial<LoopStageEvent>, options?: RecordLoopStageEventOptions): Promise<RecordLoopStageEventResult>;
export interface BatchRecordResult {
    succeeded: string[];
    failed: {
        id?: string;
        degraded: DegradedOperationResult;
    }[];
}
export declare function recordLoopStageEvents(db: StateDatabase, events: Partial<LoopStageEvent>[], options?: RecordLoopStageEventOptions): Promise<BatchRecordResult>;
