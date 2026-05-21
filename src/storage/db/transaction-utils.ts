/**
 * Transaction utilities for SQLite exclusive writes (DR-019).
 *
 * Core logic:
 * - Provides `runExclusive` for one-off transactional writes outside the queue.
 * - Uses `BEGIN EXCLUSIVE` for write isolation.
 * - Automatically rolls back on error.
 *
 * Dependencies: sql.js Database.
 * Boundary: Stateless helper; for queued writes prefer WriteQueue.
 * Test coverage: tests/unit/storage/write-queue.test.ts (indirect via queue)
 */

import type { Database } from "sql.js";

export function runExclusive<T>(
  sqlite: Database,
  fn: (sqlite: Database) => T
): T {
  sqlite.exec("BEGIN EXCLUSIVE");
  try {
    const result = fn(sqlite);
    sqlite.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // rollback may fail if no transaction active
    }
    throw err;
  }
}
