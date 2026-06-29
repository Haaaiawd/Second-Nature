import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";
import { actionClosureRecord } from "../../../src/storage/db/schema/v8-entities.js";
import {
  validateProvenanceTiers,
  buildClosureProvenance,
  cycleTraceRef,
  closureTraceRef,
  decisionProofRef,
} from "../../../src/shared/provenance-tier.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

describe("provenance-tier", () => {
  it("rejects synthetic closure ref in sourceRefs", () => {
    const bundle = buildClosureProvenance({
      sourceRefs: [closureTraceRef("cls_1")],
    });
    const result = validateProvenanceTiers(bundle);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.field, "sourceRefs");
  });

  it("rejects trace ref in proofRefs", () => {
    const bundle = buildClosureProvenance({
      proofRefs: [cycleTraceRef("cyc_1")],
    });
    const result = validateProvenanceTiers(bundle);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.field, "proofRefs");
  });

  it("accepts real evidence in sourceRefs and proofs/traces in their tiers", () => {
    const evidenceRef: SourceRef = {
      uri: "sn://evidence/ev_1",
      family: "evidence",
      id: "ev_1",
      redactionClass: "none",
      resolveStatus: "resolvable",
    };
    const bundle = buildClosureProvenance({
      sourceRefs: [evidenceRef],
      proofRefs: [decisionProofRef("dec_1"), closureTraceRef("cls_1")],
      traceRefs: [cycleTraceRef("cyc_1")],
    });
    const result = validateProvenanceTiers(bundle);
    assert.equal(result.ok, true);
  });

  it("persists proofRefs and traceRefs in closure dedicated columns", async () => {
    const db = createStateDatabase(":memory:");
    const sourceRef: SourceRef = {
      uri: "sn://evidence/ev_1",
      family: "evidence",
      id: "ev_1",
      redactionClass: "none",
      resolveStatus: "resolvable",
    };
    const proofRef = decisionProofRef("dec_1");
    const traceRef = cycleTraceRef("cyc_1");

    const result = await writeActionClosureRecord(db, {
      id: "cls_provenance_test",
      createdAt: new Date().toISOString(),
      cycleId: "cyc_1",
      platformId: "heartbeat",
      status: "completed",
      reason: "closure_completed",
      nextState: "await_next_cycle",
      sourceRefs: [sourceRef],
      proofRefs: [proofRef],
      traceRefs: [traceRef],
      redactionClass: "none",
      payload: { inputSummary: "provenance test" },
    });

    assert.equal("id" in result, true);
    if ("id" in result) {
      assert.equal(result.id, "cls_provenance_test");
    }

    const rows = await db.db
      .select()
      .from(actionClosureRecord)
      .where(eq(actionClosureRecord.id, "cls_provenance_test"));
    assert.equal(rows.length, 1);
    // T-SH.R.7: proofRefs/traceRefs now stored in dedicated JSON columns, not payloadJson
    const proofRefsJson = JSON.parse(rows[0]?.proofRefsJson ?? "[]");
    const traceRefsJson = JSON.parse(rows[0]?.traceRefsJson ?? "[]");
    assert.equal(proofRefsJson.length, 1);
    assert.equal(proofRefsJson[0].id, "dec_1");
    assert.equal(traceRefsJson.length, 1);
    assert.equal(traceRefsJson[0].id, "cyc_1");

    db.close();
  });
});
