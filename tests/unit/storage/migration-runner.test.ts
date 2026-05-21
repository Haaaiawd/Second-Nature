/**
 * T-SMS.F.2 — Migration runner unit tests.
 *
 * Verification (05A / 05B):
 * - migration runner sequential execution
 * - failure marking (schema_migration_failed, not crash)
 * - idempotent re-run (already applied migrations skipped)
 * - schema_version increments correctly
 *
 * Dependencies: sql.js, src/storage/db/migration-runner.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

import {
  runMigrations,
  isMigrationFailed,
  type Migration,
} from "../../../src/storage/db/migration-runner.js";

async function createMemoryDb() {
  const SQL = await initSqlJs();
  return new SQL.Database();
}

describe("migration-runner", () => {
  it("creates _meta table and sets schema_version = 0 on fresh DB", async () => {
    const sqlite = await createMemoryDb();
    const result = runMigrations(sqlite, []);

    assert.equal(result.schemaVersion, 0);
    assert.deepEqual(result.applied, []);
    assert.equal(result.failed, false);

    const rows = sqlite.exec(
      "SELECT value FROM _meta WHERE key = 'schema_version'"
    );
    assert.equal(rows[0].values[0][0], "0");
    sqlite.close();
  });

  it("applies single migration and increments schema_version", async () => {
    const sqlite = await createMemoryDb();

    const migrations: Migration[] = [
      {
        version: 1,
        label: "add-test-table",
        sql: "CREATE TABLE test_tbl (id TEXT PRIMARY KEY);",
      },
    ];

    const result = runMigrations(sqlite, migrations);
    assert.equal(result.schemaVersion, 1);
    assert.deepEqual(result.applied, [1]);
    assert.equal(result.failed, false);

    const tableCheck = sqlite.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_tbl'"
    );
    assert.equal(tableCheck.length, 1);
    sqlite.close();
  });

  it("applies multiple migrations in order", async () => {
    const sqlite = await createMemoryDb();

    const migrations: Migration[] = [
      {
        version: 1,
        label: "first",
        sql: "CREATE TABLE tbl_a (id TEXT PRIMARY KEY);",
      },
      {
        version: 2,
        label: "second",
        sql: "CREATE TABLE tbl_b (id TEXT PRIMARY KEY);",
      },
      {
        version: 3,
        label: "third",
        sql: "CREATE TABLE tbl_c (id TEXT PRIMARY KEY);",
      },
    ];

    const result = runMigrations(sqlite, migrations);
    assert.equal(result.schemaVersion, 3);
    assert.deepEqual(result.applied, [1, 2, 3]);
    assert.equal(result.failed, false);
    sqlite.close();
  });

  it("skips already-applied migrations (idempotent re-run)", async () => {
    const sqlite = await createMemoryDb();

    const migrations: Migration[] = [
      {
        version: 1,
        label: "first",
        sql: "CREATE TABLE tbl_x (id TEXT PRIMARY KEY);",
      },
      {
        version: 2,
        label: "second",
        sql: "CREATE TABLE tbl_y (id TEXT PRIMARY KEY);",
      },
    ];

    runMigrations(sqlite, migrations);
    const result2 = runMigrations(sqlite, migrations);

    assert.equal(result2.schemaVersion, 2);
    assert.deepEqual(result2.applied, []);
    assert.equal(result2.failed, false);
    sqlite.close();
  });

  it("applies only pending migrations when schema_version is mid-range", async () => {
    const sqlite = await createMemoryDb();

    const first: Migration[] = [
      {
        version: 1,
        label: "first",
        sql: "CREATE TABLE tbl_p (id TEXT PRIMARY KEY);",
      },
    ];
    runMigrations(sqlite, first);

    const all: Migration[] = [
      ...first,
      {
        version: 2,
        label: "second",
        sql: "CREATE TABLE tbl_q (id TEXT PRIMARY KEY);",
      },
    ];
    const result = runMigrations(sqlite, all);

    assert.equal(result.schemaVersion, 2);
    assert.deepEqual(result.applied, [2]);
    assert.equal(result.failed, false);
    sqlite.close();
  });

  it("marks schema_migration_failed on SQL error without crashing", async () => {
    const sqlite = await createMemoryDb();

    const migrations: Migration[] = [
      {
        version: 1,
        label: "good",
        sql: "CREATE TABLE tbl_ok (id TEXT PRIMARY KEY);",
      },
      {
        version: 2,
        label: "bad",
        sql: "THIS IS INVALID SQL;",
      },
    ];

    const result = runMigrations(sqlite, migrations);
    assert.equal(result.schemaVersion, 1);
    assert.deepEqual(result.applied, [1]);
    assert.equal(result.failed, true);
    assert.equal(result.failedVersion, 2);
    assert.ok(result.failedError);

    assert.equal(isMigrationFailed(sqlite), true);

    // Existing data preserved (tbl_ok still exists)
    const tableCheck = sqlite.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tbl_ok'"
    );
    assert.equal(tableCheck.length, 1);
    sqlite.close();
  });

  it("preserves existing data when a migration fails", async () => {
    const sqlite = await createMemoryDb();

    const setupMigration: Migration[] = [
      {
        version: 1,
        label: "setup",
        sql: `
          CREATE TABLE keeper (id TEXT PRIMARY KEY, val TEXT);
          INSERT INTO keeper (id, val) VALUES ('row1', 'precious');
        `,
      },
    ];
    runMigrations(sqlite, setupMigration);

    const all: Migration[] = [
      ...setupMigration,
      {
        version: 2,
        label: "boom",
        sql: "DROP TABLE nonexistent_table;",
      },
    ];
    const result = runMigrations(sqlite, all);

    assert.equal(result.failed, true);
    assert.equal(result.schemaVersion, 1);

    // Data still intact
    const rows = sqlite.exec("SELECT val FROM keeper WHERE id = 'row1'");
    assert.equal(rows[0].values[0][0], "precious");
    sqlite.close();
  });

  it("handles out-of-order migration definitions by sorting", async () => {
    const sqlite = await createMemoryDb();

    const migrations: Migration[] = [
      {
        version: 3,
        label: "third",
        sql: "CREATE TABLE tbl_3 (id TEXT PRIMARY KEY);",
      },
      {
        version: 1,
        label: "first",
        sql: "CREATE TABLE tbl_1 (id TEXT PRIMARY KEY);",
      },
      {
        version: 2,
        label: "second",
        sql: "CREATE TABLE tbl_2 (id TEXT PRIMARY KEY);",
      },
    ];

    const result = runMigrations(sqlite, migrations);
    assert.equal(result.schemaVersion, 3);
    assert.deepEqual(result.applied, [1, 2, 3]);
    sqlite.close();
  });
});
