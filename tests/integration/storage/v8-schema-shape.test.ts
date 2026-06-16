/**
 * INT-R9 — v8 schema shape regression tests.
 *
 * Core logic: assert v8 tables with a semantic `status` column no longer keep
 * a duplicate `lifecycle_status` column after fresh bootstrap or DB upgrade.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { V8_001_LIVING_PERCEPTION_LOOP } from "../../../src/storage/db/migrations/v8-001-living-perception-loop.js";
import { V8_002_PERCEPTION_CONTRACT_ALIGNMENT } from "../../../src/storage/db/migrations/v8-002-perception-contract-alignment.js";
import { V8_003_QUIET_CLOSURE_REFS } from "../../../src/storage/db/migrations/v8-003-quiet-closure-refs.js";

const SINGLE_STATUS_TABLES = [
  "action_closure_record",
  "dream_consolidation_run",
  "long_term_memory_projection",
  "heartbeat_cycle_trace",
  "loop_stage_event",
] as const;

const LIFECYCLE_ONLY_TABLES = [
  "evidence_item",
  "perception_card",
  "judgment_verdict",
  "quiet_daily_review",
  "impulse_context_artifact",
] as const;

function tableColumns(sqlite: ReturnType<typeof createStateDatabase>["sqlite"], table: string): string[] {
  const info = sqlite.exec(`PRAGMA table_info(${table})`);
  return info[0]?.values.map((row) => String(row[1])) ?? [];
}

function assertSingleStatusShape(sqlite: ReturnType<typeof createStateDatabase>["sqlite"]): void {
  for (const table of SINGLE_STATUS_TABLES) {
    const columns = tableColumns(sqlite, table);
    assert.ok(columns.includes("status"), `${table} must keep status`);
    assert.ok(!columns.includes("lifecycle_status"), `${table} must not keep lifecycle_status`);
  }

  for (const table of LIFECYCLE_ONLY_TABLES) {
    const columns = tableColumns(sqlite, table);
    assert.ok(columns.includes("lifecycle_status"), `${table} lifecycle_status is not a dual-column target`);
  }
}

describe("INT-R9 v8 single-status schema shape", () => {
  it("fresh bootstrap has no duplicate lifecycle_status on status-bearing v8 tables", () => {
    const db = createStateDatabase(":memory:");
    assertSingleStatusShape(db.sqlite);
    db.close();
  });

  it("startup upgrade removes duplicate lifecycle_status from pre-Wave-114 DBs", async () => {
    const SQL = await initSqlJs();
    const oldDb = new SQL.Database();
    oldDb.exec(V8_001_LIVING_PERCEPTION_LOOP.sql);
    oldDb.exec(V8_002_PERCEPTION_CONTRACT_ALIGNMENT.sql);
    oldDb.exec(V8_003_QUIET_CLOSURE_REFS.sql);
    oldDb.exec(`
      CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '7');
    `);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-v8-schema-shape-"));
    const dbPath = path.join(tmpDir, "state.db");
    fs.writeFileSync(dbPath, Buffer.from(oldDb.export()));
    oldDb.close();

    const upgraded = createStateDatabase(dbPath);
    assertSingleStatusShape(upgraded.sqlite);
    upgraded.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
