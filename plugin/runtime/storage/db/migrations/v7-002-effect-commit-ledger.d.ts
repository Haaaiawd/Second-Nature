/**
 * v7-002 Effect Commit Ledger migration — adds effect_commit_ledger table
 * for idempotency-backed side-effect persistence (T-CS.C.2).
 *
 * Dependencies: v7-001 (tables already exist).
 */
import type { Migration } from "../migration-runner.js";
export declare const V7_002_EFFECT_COMMIT_LEDGER: Migration;
