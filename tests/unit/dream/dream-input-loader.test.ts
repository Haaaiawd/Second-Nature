/**
 * T-DQS.C.2 — DreamInputLoader unit tests (DR-026).
 *
 * Verification (05A / 05B):
 * - Returns empty bundle when no unreferenced claims exist.
 * - Loads candidate refs from daily_diary_index and life_evidence_index.
 * - Excludes refs already consumed by accepted dream_output_index projections.
 * - Idempotent: duplicate refs across tables are deduplicated.
 * - Loads ToolExperience summaries.
 * - timeWindowDays filters out old entries.
 * - evidenceLimit caps the result set.
 *
 * Dependencies: sql.js, src/dream/dream-input-loader.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

import { createDreamInputLoader } from "../../../src/dream/dream-input-loader.js";

async function createMemoryDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE daily_diary_index (
      diary_id TEXT PRIMARY KEY,
      day TEXT NOT NULL UNIQUE,
      observed_today_json TEXT NOT NULL DEFAULT '[]',
      notable_signals_json TEXT NOT NULL DEFAULT '[]',
      tomorrow_direction TEXT NOT NULL DEFAULT '',
      source_refs_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE dream_output_index (
      output_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      canonical_entries_json TEXT NOT NULL DEFAULT '[]',
      insights_json TEXT NOT NULL DEFAULT '[]',
      narrative_update_json TEXT,
      relationship_update_json TEXT,
      validation_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE tool_experience (
      experience_id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      failure_class TEXT,
      latency_ms INTEGER NOT NULL,
      evidence_quality REAL NOT NULL DEFAULT 0,
      source_refs_json TEXT NOT NULL,
      trigger_source TEXT NOT NULL DEFAULT 'heartbeat',
      created_at TEXT NOT NULL
    );

    CREATE TABLE life_evidence_index (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      sensitivity TEXT NOT NULL,
      producer TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      platform_id TEXT,
      source_refs_json TEXT NOT NULL
    );
  `);
  return db;
}

describe("createDreamInputLoader", () => {
  it("returns empty bundle when no data exists", async () => {
    const sqlite = await createMemoryDb();
    const loader = createDreamInputLoader({ database: { sqlite } });

    const bundle = await loader.loadDreamInputs({});

    assert.deepEqual(bundle.evidenceRefs, []);
    assert.deepEqual(bundle.chronicleEntryIds, []);
    assert.deepEqual(bundle.goalSnapshotIds, []);
    assert.equal(bundle.inputCounts.evidence, 0);
    assert.equal(bundle.inputCounts.chronicle, 0);
    assert.equal(bundle.inputCounts.memoryEntries, 0);
    assert.ok(bundle.toolExperienceSummaries);
    assert.equal(bundle.toolExperienceSummaries!.length, 0);
  });

  it("loads refs from daily_diary_index when no accepted projection", async () => {
    const sqlite = await createMemoryDb();
    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify([{ id: "ref-a" }, { id: "ref-b" }]),
        new Date().toISOString(),
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 2);
    assert.ok(bundle.evidenceRefs.includes("ref-a"));
    assert.ok(bundle.evidenceRefs.includes("ref-b"));
  });

  it("excludes refs consumed by accepted dream outputs", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify([{ id: "ref-a" }, { id: "ref-b" }]),
        now,
      ],
    );

    sqlite.run(
      `INSERT INTO dream_output_index (output_id, run_id, status, canonical_entries_json, insights_json, validation_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "out-1",
        "run-1",
        "accepted",
        JSON.stringify([
          {
            entryId: "ent-1",
            kind: "memory",
            summary: "s1",
            sourceRefs: [{ sourceId: "ref-a" }],
            createdAt: now,
          },
        ]),
        "[]",
        JSON.stringify({
          schemaValid: true,
          sourceGrounded: true,
          sensitivityClean: true,
          unsupportedClaims: [],
          errors: [],
          checkedAt: now,
        }),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 1);
    assert.ok(bundle.evidenceRefs.includes("ref-b"));
    assert.ok(!bundle.evidenceRefs.includes("ref-a"));
  });

  it("deduplicates refs across multiple diary entries", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify([{ id: "ref-a" }]),
        now,
      ],
    );
    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-2",
        "2026-05-21",
        JSON.stringify([{ id: "ref-a" }, { id: "ref-c" }]),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 2);
    assert.ok(bundle.evidenceRefs.includes("ref-a"));
    assert.ok(bundle.evidenceRefs.includes("ref-c"));
  });

  it("loads refs from life_evidence_index", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO life_evidence_index (id, timestamp, evidence_type, sensitivity, producer, artifact_path, source_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "lev-1",
        now,
        "observation",
        "low",
        "test",
        "path",
        JSON.stringify([{ id: "lev-ref-1" }, { id: "lev-ref-2" }]),
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 2);
    assert.ok(bundle.evidenceRefs.includes("lev-ref-1"));
    assert.ok(bundle.evidenceRefs.includes("lev-ref-2"));
  });

  it("loads ToolExperience summaries", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO tool_experience (experience_id, connector_id, capability_id, outcome, latency_ms, source_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "te-1",
        "conn-a",
        "cap-1",
        "success",
        42,
        "[]",
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.ok(bundle.toolExperienceSummaries);
    assert.equal(bundle.toolExperienceSummaries!.length, 1);
    assert.equal(bundle.toolExperienceSummaries![0]!.connectorId, "conn-a");
    assert.equal(bundle.toolExperienceSummaries![0]!.capabilityId, "cap-1");
    assert.equal(bundle.toolExperienceSummaries![0]!.outcome, "success");
    assert.equal(bundle.toolExperienceSummaries![0]!.count, 1);
  });

  it("aggregates multiple ToolExperience records with same connector/capability/outcome", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    for (let i = 0; i < 3; i++) {
      sqlite.run(
        `INSERT INTO tool_experience (experience_id, connector_id, capability_id, outcome, latency_ms, source_refs_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `te-${i}`,
          "conn-a",
          "cap-1",
          "success",
          42 + i,
          "[]",
          now,
        ],
      );
    }

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.toolExperienceSummaries!.length, 1);
    assert.equal(bundle.toolExperienceSummaries![0]!.count, 3);
    assert.equal(bundle.toolExperienceSummaries![0]!.connectorId, "conn-a");
    assert.equal(bundle.toolExperienceSummaries![0]!.capabilityId, "cap-1");
    assert.equal(bundle.toolExperienceSummaries![0]!.outcome, "success");
  });

  it("separates ToolExperience summaries by outcome", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO tool_experience (experience_id, connector_id, capability_id, outcome, latency_ms, source_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["te-1", "conn-a", "cap-1", "success", 42, "[]", now],
    );
    sqlite.run(
      `INSERT INTO tool_experience (experience_id, connector_id, capability_id, outcome, latency_ms, source_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["te-2", "conn-a", "cap-1", "failure", 100, "[]", now],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.toolExperienceSummaries!.length, 2);
    const successSummary = bundle.toolExperienceSummaries!.find(
      (s) => s.outcome === "success",
    );
    const failureSummary = bundle.toolExperienceSummaries!.find(
      (s) => s.outcome === "failure",
    );
    assert.ok(successSummary);
    assert.ok(failureSummary);
    assert.equal(successSummary!.count, 1);
    assert.equal(failureSummary!.count, 1);
  });

  it("handles empty string source_refs_json gracefully", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      ["diary-1", "2026-05-20", "", now],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.deepEqual(bundle.evidenceRefs, []);
    assert.equal(bundle.inputCounts.evidence, 0);
  });

  it("handles 'null' string source_refs_json gracefully", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      ["diary-1", "2026-05-20", "null", now],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.deepEqual(bundle.evidenceRefs, []);
    assert.equal(bundle.inputCounts.evidence, 0);
  });

  it("handles mixed-format source_refs_json", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify(["str-ref", { id: "obj-ref" }, { sourceId: "src-ref" }]),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 3);
    assert.ok(bundle.evidenceRefs.includes("str-ref"));
    assert.ok(bundle.evidenceRefs.includes("obj-ref"));
    assert.ok(bundle.evidenceRefs.includes("src-ref"));
  });

  it("filters out old entries with timeWindowDays", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-recent",
        "2026-05-20",
        JSON.stringify([{ id: "ref-recent" }]),
        now,
      ],
    );
    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-old",
        "2026-03-20",
        JSON.stringify([{ id: "ref-old" }]),
        old,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({ timeWindowDays: 30 });

    assert.equal(bundle.evidenceRefs.length, 1);
    assert.ok(bundle.evidenceRefs.includes("ref-recent"));
    assert.ok(!bundle.evidenceRefs.includes("ref-old"));
  });

  it("respects evidenceLimit on life_evidence_index", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    for (let i = 0; i < 5; i++) {
      sqlite.run(
        `INSERT INTO life_evidence_index (id, timestamp, evidence_type, sensitivity, producer, artifact_path, source_refs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `lev-${i}`,
          now,
          "observation",
          "low",
          "test",
          "path",
          JSON.stringify([{ id: `ref-${i}` }]),
        ],
      );
    }

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({ evidenceLimit: 2 });

    // Only 2 life_evidence rows should be read; but each has 1 ref, so 2 refs max.
    // Note: SQLite LIMIT limits rows, not refs, so we get <= 2 refs from life_evidence.
    assert.ok(bundle.evidenceRefs.length <= 2);
  });

  it("handles string-array source_refs_json in diary", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify(["str-ref-1", "str-ref-2"]),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 2);
    assert.ok(bundle.evidenceRefs.includes("str-ref-1"));
    assert.ok(bundle.evidenceRefs.includes("str-ref-2"));
  });

  it("handles canonical entries with string sourceRefs", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify(["str-ref-a", "str-ref-b"]),
        now,
      ],
    );

    sqlite.run(
      `INSERT INTO dream_output_index (output_id, run_id, status, canonical_entries_json, insights_json, validation_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "out-1",
        "run-1",
        "accepted",
        JSON.stringify([
          {
            entryId: "ent-1",
            kind: "memory",
            summary: "s1",
            sourceRefs: ["str-ref-a"],
            createdAt: now,
          },
        ]),
        "[]",
        JSON.stringify({
          schemaValid: true,
          sourceGrounded: true,
          sensitivityClean: true,
          unsupportedClaims: [],
          errors: [],
          checkedAt: now,
        }),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    assert.equal(bundle.evidenceRefs.length, 1);
    assert.ok(bundle.evidenceRefs.includes("str-ref-b"));
  });

  it("does not exclude refs from candidate (non-accepted) outputs", async () => {
    const sqlite = await createMemoryDb();
    const now = new Date().toISOString();

    sqlite.run(
      `INSERT INTO daily_diary_index (diary_id, day, source_refs_json, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        "diary-1",
        "2026-05-20",
        JSON.stringify([{ id: "ref-x" }]),
        now,
      ],
    );

    sqlite.run(
      `INSERT INTO dream_output_index (output_id, run_id, status, canonical_entries_json, insights_json, validation_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "out-1",
        "run-1",
        "candidate",
        JSON.stringify([
          {
            entryId: "ent-1",
            kind: "memory",
            summary: "s1",
            sourceRefs: [{ sourceId: "ref-x" }],
            createdAt: now,
          },
        ]),
        "[]",
        JSON.stringify({
          schemaValid: true,
          sourceGrounded: true,
          sensitivityClean: true,
          unsupportedClaims: [],
          errors: [],
          checkedAt: now,
        }),
        now,
      ],
    );

    const loader = createDreamInputLoader({ database: { sqlite } });
    const bundle = await loader.loadDreamInputs({});

    // Candidate outputs do NOT consume refs; only accepted do.
    assert.equal(bundle.evidenceRefs.length, 1);
    assert.ok(bundle.evidenceRefs.includes("ref-x"));
  });
});
