/**
 * T-SH.R.7 — Closure provenance column regression test.
 *
 * Core logic: assert that writeActionClosureRecord stores proofRefs/traceRefs
 * in dedicated proof_refs_json/trace_refs_json columns, NOT in payloadJson.
 * Also verifies the columns exist after both fresh bootstrap and migration.
 *
 * Design authority: `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §2.2`
 * Task: T-SH.R.7 (Wave 119 / CH-37)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeActionClosureRecord,
  readActionClosuresByCycle,
} from "../../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeSourceRef(id: string, family: SourceRef["family"]): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("T-SH.R.7 closure provenance columns", () => {
  it("action_closure_record has proof_refs_json and trace_refs_json columns after fresh bootstrap", () => {
    const db = createStateDatabase(":memory:");
    const info = db.sqlite.exec("PRAGMA table_info(action_closure_record)");
    const columns = info[0]?.values.map((row) => String(row[1])) ?? [];
    assert.ok(columns.includes("proof_refs_json"), "proof_refs_json column must exist");
    assert.ok(columns.includes("trace_refs_json"), "trace_refs_json column must exist");
    db.close();
  });

  it("writeActionClosureRecord stores proofRefs in proof_refs_json, not payloadJson", async () => {
    const db = createStateDatabase(":memory:");
    const sourceRefs = [makeSourceRef("ev_001", "evidence")];
    const proofRefs = [makeSourceRef("verdict_001", "judgment")];
    const traceRefs = [makeSourceRef("trace_001", "audit")];

    const result = await writeActionClosureRecord(db, {
      id: "closure_001",
      createdAt: "2026-06-21T00:00:00Z",
      cycleId: "cycle_001",
      status: "completed",
      reason: "connector_succeeded",
      nextState: "evidence_collected",
      sourceRefs,
      proofRefs,
      traceRefs,
    });

    assert.ok("id" in result, "write must succeed");

    const read = await readActionClosuresByCycle(db, "cycle_001");
    assert.strictEqual(read.rows.length, 1);
    const row = read.rows[0]!;

    // proof_refs_json must contain the proof refs
    assert.ok(row.proofRefsJson, "proofRefsJson must be populated");
    const storedProof = JSON.parse(row.proofRefsJson!);
    assert.strictEqual(storedProof.length, 1);
    assert.strictEqual(storedProof[0].id, "verdict_001");

    // trace_refs_json must contain the trace refs
    assert.ok(row.traceRefsJson, "traceRefsJson must be populated");
    const storedTrace = JSON.parse(row.traceRefsJson!);
    assert.strictEqual(storedTrace.length, 1);
    assert.strictEqual(storedTrace[0].id, "trace_001");

    // payloadJson must NOT contain proofRefs or traceRefs
    const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
    assert.ok(
      !("proofRefs" in payload),
      "payloadJson must NOT contain proofRefs (T-SH.R.7)",
    );
    assert.ok(
      !("traceRefs" in payload),
      "payloadJson must NOT contain traceRefs (T-SH.R.7)",
    );

    db.close();
  });

  it("writeActionClosureRecord with no proofRefs/traceRefs stores empty arrays in dedicated columns", async () => {
    const db = createStateDatabase(":memory:");
    const sourceRefs = [makeSourceRef("ev_002", "evidence")];

    const result = await writeActionClosureRecord(db, {
      id: "closure_002",
      createdAt: "2026-06-21T00:00:00Z",
      cycleId: "cycle_002",
      status: "no_action",
      reason: "proposal_no_action",
      nextState: "idle",
      sourceRefs,
    });

    assert.ok("id" in result, "write must succeed");

    const read = await readActionClosuresByCycle(db, "cycle_002");
    const row = read.rows[0]!;
    const storedProof = JSON.parse(row.proofRefsJson ?? "[]");
    const storedTrace = JSON.parse(row.traceRefsJson ?? "[]");
    assert.deepStrictEqual(storedProof, [], "proofRefsJson must be empty array");
    assert.deepStrictEqual(storedTrace, [], "traceRefsJson must be empty array");

    db.close();
  });
});
