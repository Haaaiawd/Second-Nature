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
const MAX_RETRIES = 3;
const BACKOFF_MS = 50;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isBusyError(err) {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return msg.includes("busy") || msg.includes("locked") || msg.includes("database is locked");
    }
    return false;
}
export class WriteQueue {
    sqlite;
    queue = [];
    processing = false;
    constructor(sqlite) {
        this.sqlite = sqlite;
    }
    enqueue(request) {
        return new Promise((resolve) => {
            this.queue.push({
                request: request,
                resolve: resolve,
            });
            this.drain();
        });
    }
    async drain() {
        if (this.processing) {
            return;
        }
        this.processing = true;
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            const result = await this.executeWithRetry(item.request);
            item.resolve(result);
        }
        this.processing = false;
    }
    async executeWithRetry(request) {
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.sqlite.exec("BEGIN EXCLUSIVE");
                const value = request.execute(this.sqlite);
                this.sqlite.exec("COMMIT");
                return {
                    ok: true,
                    value,
                    triggerSource: request.triggerSource,
                };
            }
            catch (err) {
                try {
                    this.sqlite.exec("ROLLBACK");
                }
                catch {
                    // rollback may fail if no transaction active
                }
                const message = err instanceof Error ? err.message : String(err);
                lastError = message;
                if (isBusyError(err) && attempt < MAX_RETRIES) {
                    await sleep(BACKOFF_MS * (attempt + 1));
                    continue;
                }
                break;
            }
        }
        process.stderr.write(`write_queue_flush_failed: ${request.label} [${request.triggerSource}] — ${lastError}\n`);
        return {
            ok: false,
            error: lastError,
            triggerSource: request.triggerSource,
        };
    }
    get pending() {
        return this.queue.length;
    }
}
export function createWriteQueue(sqlite) {
    return new WriteQueue(sqlite);
}
