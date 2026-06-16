/**
 * v8-004 Schema Closure — brings pre-existing v8 DBs up to the current bootstrap schema.
 *
 * Problem: v8-001 created the first v8 tables, but daily_rhythm_state,
 * impulse_context_artifact, connector_cooldown_state, and several columns
 * (action_closure_record.platform_id/capability_id,
 * quiet_daily_review.closure_refs_json, connector_cooldown_state.terminal_count)
 * were added later only in the bootstrap SQL. DBs initialized before those
 * bootstrap changes would miss tables/columns and break at runtime.
 *
 * Strategy:
 * - CREATE TABLE IF NOT EXISTS for the three tables (idempotent on fresh DBs).
 * - Column-level fixes are handled by the defensive applyStateSchemaMigrations
 *   helper in db/index.ts, because SQLite cannot conditionally ADD COLUMN.
 *
 * Resolves T-SMS.R.2.
 */
import type { Migration } from "../migration-runner.js";
export declare const V8_004_SCHEMA_CLOSURE: Migration;
