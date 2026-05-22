/**
 * Serial write queue with concurrency protection (DR-019).
 *
 * Core logic:
 * - All DB writes are funneled through a single serial queue.
 * - Each write executes inside a `BEGIN EXCLUSIVE` transaction.
 * - On SQLITE_BUSY or equivalent, retries up to 3 times with 50ms backoff.
 * - Flush failure writes to stderr without blocking read paths.
 * - `triggerSource` is preserved through the write pipeline.
 *
 * Dependencies: sql.js Database.
 * Boundary: Wraps raw SQL execution; callers enqueue write operations.
 * Test coverage: tests/unit/storage/write-queue.test.ts
 */
import type { Database } from "sql.js";
export type TriggerSource = "heartbeat" | "manual_run" | "probe" | "idle_curiosity";
export interface WriteRequest<T = unknown> {
    label: string;
    triggerSource: TriggerSource;
    execute: (sqlite: Database) => T;
}
export interface WriteResult<T = unknown> {
    ok: boolean;
    value?: T;
    error?: string;
    triggerSource: TriggerSource;
}
export declare class WriteQueue {
    private readonly sqlite;
    private queue;
    private processing;
    constructor(sqlite: Database);
    enqueue<T>(request: WriteRequest<T>): Promise<WriteResult<T>>;
    private drain;
    private executeWithRetry;
    get pending(): number;
}
export declare function createWriteQueue(sqlite: Database): WriteQueue;
