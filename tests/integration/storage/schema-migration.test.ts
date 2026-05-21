/**
 * T-SMS.F.2 — Schema migration integration tests.
 *
 * Verification (05A / 05B):
 * - Fresh DB: v7-001 migration creates all tables, schema_version = 1
 * - Old schema: pending migrations applied sequentially
 * - Failed SQL: marks degraded, existing data preserved
 *
 * Dependencies: sql.js, migration-runner, v7-001-foundation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

import {
  runMigrations,
  isMigrationFailed,
} from "../../../src/storage/db/migration-runner.js";
import { ALL_MIGRATIONS } from "../../../src/storage/db/migrations/index.js";

async function createMemoryDb() {
  const SQL = await initSqlJs();
  return new SQL.Database();
}

const V7_EXPECTED_TABLES = [
  "identity_profile",
  "tool_experience",
  "daily_diary_index",
  "dream_output_index",
  "capability_probe_result",
  "restore_snapshot",
  "runtime_secret_anchor",
  "heartbeat_digest",
  "narrative_timeline",
];

describe("schema-migration integration (v7-001)", () => {
  it("fresh DB: all v7 tables created and schema_version = 1", async () => {
    const sqlite = await createMemoryDb();

    // Pre-create the legacy tables that v7-001 extends
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_goal (
        goal_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        description TEXT NOT NULL,
        completion_criteria TEXT NOT NULL,
        risk TEXT NOT NULL,
        priority_hint INTEGER NOT NULL DEFAULT 0,
        source_refs_json TEXT NOT NULL,
        accepted_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const result = runMigrations(sqlite, ALL_MIGRATIONS);

    assert.equal(result.schemaVersion, 1);
    assert.deepEqual(result.applied, [1]);
    assert.equal(result.failed, false);
    assert.equal(isMigrationFailed(sqlite), false);

    // Verify all expected tables exist
    for (const table of V7_EXPECTED_TABLES) {
      const check = sqlite.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
      );
      assert.equal(
        check.length,
        1,
        `Expected table '${table}' to exist`
      );
    }

    // Verify agent_goal v7 columns exist
    const goalInfo = sqlite.exec("PRAGMA table_info(agent_goal)");
    const columnNames = goalInfo[0].values.map((row) => row[1]);
    assert.ok(
      columnNames.includes("scope"),
      "agent_goal should have 'scope' column"
    );
    assert.ok(
      columnNames.includes("expires_at"),
      "agent_goal should have 'expires_at' column"
    );

    sqlite.close();
  });

  it("re-running migrations on migrated DB is idempotent", async () => {
    const sqlite = await createMemoryDb();

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_goal (
        goal_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        description TEXT NOT NULL,
        completion_criteria TEXT NOT NULL,
        risk TEXT NOT NULL,
        priority_hint INTEGER NOT NULL DEFAULT 0,
        source_refs_json TEXT NOT NULL,
        accepted_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    runMigrations(sqlite, ALL_MIGRATIONS);
    const result2 = runMigrations(sqlite, ALL_MIGRATIONS);

    assert.equal(result2.schemaVersion, 1);
    assert.deepEqual(result2.applied, []);
    assert.equal(result2.failed, false);
    sqlite.close();
  });

  it("failed migration SQL marks degraded without losing data", async () => {
    const sqlite = await createMemoryDb();

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_goal (
        goal_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        description TEXT NOT NULL,
        completion_criteria TEXT NOT NULL,
        risk TEXT NOT NULL,
        priority_hint INTEGER NOT NULL DEFAULT 0,
        source_refs_json TEXT NOT NULL,
        accepted_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO agent_goal (goal_id, kind, status, origin, description,
        completion_criteria, risk, priority_hint, source_refs_json,
        created_at, updated_at)
      VALUES ('g1', 'short_term', 'accepted', 'owner_set', 'test',
        'criteria', 'low', 1, '["ref1"]',
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    `);

    // Inject a bad migration after the real ones
    const migrationsWithBad = [
      ...ALL_MIGRATIONS,
      {
        version: 999,
        label: "intentionally-broken",
        sql: "ALTER TABLE nonexistent_table ADD COLUMN x TEXT;",
      },
    ];

    const result = runMigrations(sqlite, migrationsWithBad);

    assert.equal(result.failed, true);
    assert.equal(result.failedVersion, 999);
    assert.equal(result.schemaVersion, 1); // v7-001 succeeded
    assert.equal(isMigrationFailed(sqlite), true);

    // Existing data preserved
    const rows = sqlite.exec(
      "SELECT goal_id FROM agent_goal WHERE goal_id = 'g1'"
    );
    assert.equal(rows[0].values[0][0], "g1");
    sqlite.close();
  });

  it("v7 tables have correct column defaults (DEFAULT NULL)", async () => {
    const sqlite = await createMemoryDb();

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_goal (
        goal_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        description TEXT NOT NULL,
        completion_criteria TEXT NOT NULL,
        risk TEXT NOT NULL,
        priority_hint INTEGER NOT NULL DEFAULT 0,
        source_refs_json TEXT NOT NULL,
        accepted_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    runMigrations(sqlite, ALL_MIGRATIONS);

    // Insert into identity_profile with minimal fields
    sqlite.exec(`
      INSERT INTO identity_profile (profile_id, canonical_name, updated_at)
      VALUES ('p1', 'TestAgent', '2026-01-01T00:00:00Z');
    `);

    const rows = sqlite.exec(
      "SELECT canonical_avatar, canonical_bio FROM identity_profile WHERE profile_id = 'p1'"
    );
    // Should be NULL (default)
    assert.equal(rows[0].values[0][0], null);
    assert.equal(rows[0].values[0][1], null);

    // agent_goal scope/expires_at should be NULL for pre-existing rows
    sqlite.exec(`
      INSERT INTO agent_goal (goal_id, kind, status, origin, description,
        completion_criteria, risk, priority_hint, source_refs_json,
        created_at, updated_at)
      VALUES ('g-new', 'short_term', 'proposal', 'agent_proposed', 'desc',
        'criteria', 'low', 0, '["ref"]',
        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    `);

    const goalRows = sqlite.exec(
      "SELECT scope, expires_at FROM agent_goal WHERE goal_id = 'g-new'"
    );
    assert.equal(goalRows[0].values[0][0], null);
    assert.equal(goalRows[0].values[0][1], null);

    sqlite.close();
  });
});
