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

export const V8_004_SCHEMA_CLOSURE: Migration = {
  version: 8,
  label: "v8-schema-closure",
  sql: `
    CREATE TABLE IF NOT EXISTS daily_rhythm_state (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      quiet_status TEXT NOT NULL DEFAULT 'not_due',
      dream_status TEXT NOT NULL DEFAULT 'not_due',
      quiet_reason TEXT,
      dream_reason TEXT,
      quiet_completed_at TEXT,
      dream_completed_at TEXT,
      source_refs_json TEXT NOT NULL,
      payload_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS impulse_context_artifact (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      scene_type TEXT NOT NULL,
      capability_intent TEXT,
      platform_id TEXT,
      capability_class TEXT,
      impulse_source TEXT NOT NULL,
      impulse_text TEXT,
      atmosphere_text TEXT,
      expression_boundary_constraints_json TEXT,
      expression_boundary_style TEXT,
      freshness_version INTEGER NOT NULL DEFAULT 1,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS connector_cooldown_state (
      id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      failure_class TEXT NOT NULL,
      retry_after_ms INTEGER,
      blocked_until TEXT NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 1,
      terminal_count INTEGER NOT NULL DEFAULT 0,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS connector_cooldown_state_platform_capability_idx
      ON connector_cooldown_state(platform_id, capability_id);
  `,
};
