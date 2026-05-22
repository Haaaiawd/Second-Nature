/**
 * EffectCommitLedger SQLite implementation — T-CS.C.2
 *
 * Core logic: Persists effect-commit records to SQLite with idempotency-key
 * uniqueness. On process restart, a previously committed key returns
 * `{ existing: true, record: { ... } }`, enabling replay without side-effect.
 *
 * Implements `EffectCommitLedgerPort` from `./execution-policy.js`.
 *
 * Dependencies:
 * - `StateDatabase` from `../../storage/db/index.js`
 * - `EffectCommitLedgerPort` from `./execution-policy.js`
 *
 * Boundary:
 * - idempotency_key is UNIQUE; duplicate insert attempts are caught and
 *   resolved to the existing record.
 * - `markCommitted` is an extension beyond the port for use by execution
 *   adapters to transition state from `planned`/`dispatched` to `committed`.
 *
 * Test coverage: tests/unit/connectors/effect-commit-ledger-sqlite.test.ts
 */

import * as crypto from "node:crypto";
import type { StateDatabase } from "../../storage/db/index.js";
import type { EffectCommitLedgerPort } from "./execution-policy.js";

export interface EffectCommitLedgerSQLite extends EffectCommitLedgerPort {
  /** Transition an existing record to committed with an outcome ref. */
  markCommitted(
    idempotencyKey: string,
    outcomeRef: string,
  ): Promise<{ ok: boolean; previousState?: string }>;
}

export function createEffectCommitLedgerSQLite(
  database: StateDatabase,
): EffectCommitLedgerSQLite {
  const { sqlite } = database;

  return {
    async getOrCreateIntentCommitRecord(input) {
      // Try insert first; if UNIQUE conflict, read existing
      const commitId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      try {
        sqlite.run(
          `INSERT INTO effect_commit_ledger
           (commit_id, idempotency_key, decision_id, intent_id, effect_class, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            commitId,
            input.idempotencyKey,
            input.decisionId,
            input.intentId,
            input.effectClass,
            "planned",
            createdAt,
          ],
        );
        return {
          existing: false,
          record: { id: commitId, state: "planned" },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // SQLite UNIQUE constraint violation codes: 2067 (SQLITE_CONSTRAINT_UNIQUE)
        if (msg.includes("UNIQUE constraint failed") || msg.includes("constraint")) {
          const existingResult = sqlite.exec(
            `SELECT commit_id, status, outcome_ref
             FROM effect_commit_ledger
             WHERE idempotency_key = ?`,
            [input.idempotencyKey],
          );
          if (
            existingResult.length > 0 &&
            existingResult[0]!.values.length > 0
          ) {
            const cols = existingResult[0]!.columns;
            const row = existingResult[0]!.values[0]!;
            const get = (name: string) => row[cols.indexOf(name)] as string | null;
            return {
              existing: true,
              record: {
                id: get("commit_id")!,
                state: get("status")!,
                outcomeRef: (get("outcome_ref") as string | null) ?? undefined,
              },
            };
          }
        }
        throw err;
      }
    },

    async markCommitted(idempotencyKey, outcomeRef) {
      const currentResult = sqlite.exec(
        `SELECT status FROM effect_commit_ledger WHERE idempotency_key = ?`,
        [idempotencyKey],
      );
      if (
        currentResult.length === 0 ||
        currentResult[0]!.values.length === 0
      ) {
        return { ok: false };
      }

      const previousState = currentResult[0]!.values[0]![0] as string;
      const committedAt = new Date().toISOString();

      sqlite.run(
        `UPDATE effect_commit_ledger
         SET status = ?, outcome_ref = ?, committed_at = ?
         WHERE idempotency_key = ?`,
        ["committed", outcomeRef, committedAt, idempotencyKey],
      );

      return { ok: true, previousState };
    },
  };
}
