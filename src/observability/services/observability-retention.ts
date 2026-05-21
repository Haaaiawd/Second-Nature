/**
 * Observability retention cleanup (P2-06).
 *
 * Core logic: delete rows older than a retention threshold from
 * decision_ledger and execution_attempts. Host capability reports and
 * governance audit are intentionally kept longer (they are rare and
 * operator-relevant).
 *
 * Boundaries:
 *  - Does NOT vacuum the SQLite file (callers may do so separately).
 *  - Returns honest counts so operators can verify.
 *  - Safe to run while the system is active (SQLite DELETE is row-level).
 */
import { lt, sql } from "drizzle-orm";
import type { ObservabilityDatabase } from "../db/index.js";
import { decisionLedger, executionAttempts } from "../db/schema/index.js";

export interface RetentionCleanupInput {
  /** Delete rows with createdAt < this ISO string. */
  beforeDate: string;
}

export interface RetentionCleanupResult {
  decisionLedgerDeleted: number;
  executionAttemptsDeleted: number;
}

export async function pruneObservabilityTables(
  db: ObservabilityDatabase,
  input: RetentionCleanupInput,
): Promise<RetentionCleanupResult> {
  // Count before delete so we can return honest deletion numbers
  // (SQLite DELETE result does not expose changes in Drizzle's type).
  const dlBefore = await db.db
    .select({ count: sql<number>`count(*)` })
    .from(decisionLedger)
    .where(lt(decisionLedger.createdAt, input.beforeDate));
  const eaBefore = await db.db
    .select({ count: sql<number>`count(*)` })
    .from(executionAttempts)
    .where(lt(executionAttempts.startedAt, input.beforeDate));

  await db.db
    .delete(decisionLedger)
    .where(lt(decisionLedger.createdAt, input.beforeDate));
  await db.db
    .delete(executionAttempts)
    .where(lt(executionAttempts.startedAt, input.beforeDate));

  return {
    decisionLedgerDeleted: dlBefore[0]?.count ?? 0,
    executionAttemptsDeleted: eaBefore[0]?.count ?? 0,
  };
}
