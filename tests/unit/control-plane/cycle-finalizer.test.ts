import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { finalizeCycle } from "../../../src/core/second-nature/control-plane/cycle-finalizer.js";
import { readActionClosuresByCycle } from "../../../src/storage/v8-state-stores.js";

describe("cycle-finalizer", () => {
  it("records exactly one no-action closure per cycle", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc_1";

    const result1 = await finalizeCycle(db, cycleId, {
      kind: "no_action",
      reason: "evidence_batch_empty",
    });
    assert.ok(result1.closureRef, JSON.stringify(result1));

    const result2 = await finalizeCycle(db, cycleId, {
      kind: "no_action",
      reason: "proposal_no_action",
    });
    // Idempotent: second call should return the existing closure
    assert.ok(result2.closureRef, JSON.stringify(result2));

    const closures = await readActionClosuresByCycle(db, cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0]?.status, "no_action");

    db.close();
  });

  it("records policy outcome closure", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc_2";

    const result = await finalizeCycle(db, cycleId, {
      kind: "policy",
      closureStatus: "denied",
      reason: "policy_denied_high_risk",
      proposalId: "prop_1",
      decisionId: "dec_1",
    });

    assert.ok(result.closureRef);
    const closures = await readActionClosuresByCycle(db, cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0]?.status, "denied");

    db.close();
  });

  it("records execution outcome closure", async () => {
    const db = createStateDatabase(":memory:");
    const cycleId = "cyc_3";

    const result = await finalizeCycle(db, cycleId, {
      kind: "execution",
      closureStatus: "completed",
      reason: "execution_completed",
      proposalId: "prop_1",
      decisionId: "dec_1",
      executionResultRef: "sn://execution/exec_1",
    });

    assert.ok(result.closureRef);
    const closures = await readActionClosuresByCycle(db, cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0]?.status, "completed");

    db.close();
  });
});
