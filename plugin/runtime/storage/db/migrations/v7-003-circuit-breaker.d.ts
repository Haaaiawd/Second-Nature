/**
 * v7-003 Circuit Breaker migration — adds circuit_breaker_state table.
 *
 * Dependencies: v7-002 (effect_commit_ledger already exists).
 */
import type { Migration } from "../migration-runner.js";
export declare const V7_003_CIRCUIT_BREAKER: Migration;
