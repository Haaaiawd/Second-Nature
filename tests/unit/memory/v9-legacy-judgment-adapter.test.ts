/**
 * v8 JudgmentVerdict → v9 AttentionSignal legacy adapter tests.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { judgmentVerdict } from "../../../src/storage/db/schema/v8-entities.js";
import { readLegacyJudgmentVerdictAsAttentionSignal } from "../../../src/storage/v9-legacy-judgment-adapter.js";

describe("v9 legacy judgment adapter", () => {
  let db: StateDatabase;

  beforeEach(() => {
    db = createStateDatabase(":memory:");
  });

  it("maps existing v8 judgment verdict to degraded AttentionSignal", async () => {
    await db.db.insert(judgmentVerdict).values({
      id: "jv-1",
      createdAt: new Date().toISOString(),
      cycleId: "cycle-1",
      perceptionCardId: "pc-1",
      actionKind: "run_connector",
      confidence: 0.8,
      reason: "legacy reason",
      riskPosture: "high",
      sourceRefsJson: JSON.stringify([{ family: "perception", id: "pc-1" }]),
      redactionClass: "none",
      payloadJson: JSON.stringify({ summary: "legacy summary" }),
      lifecycleStatus: "pending",
    });

    const result = await readLegacyJudgmentVerdictAsAttentionSignal(db, "jv-1");
    assert.equal(result.kind, "mapped");
    assert.ok(result.signal);
    assert.equal(result.signal?.status, "degraded");
    assert.equal(result.signal?.reason, "v8_legacy_judgment_mapped");
    assert.equal(result.signal?.risk, "high");
    assert.deepEqual(result.signal?.possibleActions, []);
    assert.equal(result.signal?.sourceRefs[0]?.family, "attention");
    assert.equal(result.signal?.sourceRefs[0]?.id, "jv-1");
  });

  it("returns not_found for missing judgment id", async () => {
    const result = await readLegacyJudgmentVerdictAsAttentionSignal(db, "missing");
    assert.equal(result.kind, "not_found");
    assert.equal(result.signal, undefined);
  });

  it("maps low risk posture correctly", async () => {
    await db.db.insert(judgmentVerdict).values({
      id: "jv-2",
      createdAt: new Date().toISOString(),
      cycleId: "cycle-1",
      perceptionCardId: "pc-1",
      actionKind: "watch",
      confidence: 0.4,
      reason: "legacy reason",
      riskPosture: "low",
      sourceRefsJson: JSON.stringify([{ family: "perception", id: "pc-1" }]),
      redactionClass: "none",
      payloadJson: "{}",
      lifecycleStatus: "pending",
    });

    const result = await readLegacyJudgmentVerdictAsAttentionSignal(db, "jv-2");
    assert.equal(result.signal?.risk, "low");
  });
});
