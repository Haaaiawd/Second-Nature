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
import type { StateDatabase } from "../../storage/db/index.js";
import type { EffectCommitLedgerPort } from "./execution-policy.js";
export interface EffectCommitLedgerSQLite extends EffectCommitLedgerPort {
    /** Transition an existing record to committed with an outcome ref. */
    markCommitted(idempotencyKey: string, outcomeRef: string): Promise<{
        ok: boolean;
        previousState?: string;
    }>;
}
export declare function createEffectCommitLedgerSQLite(database: StateDatabase): EffectCommitLedgerSQLite;
