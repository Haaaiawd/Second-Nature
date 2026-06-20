/**
 * T-AC.R.3 — CycleFinalizer idempotency, write order, and reconcile tests.
 *
 * Core logic: verify that finalizeCycle enforces exactly-one terminal closure
 * per cycleId, returns closure_idempotency_conflict on duplicate, and
 * reconcileCycleClosure detects orphaned closure/event rows.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §6.1a`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 *
 * Task: T-AC.R.3 (Wave 119 / CH-36, CH-50)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  finalizeCycle,
  reconcileCycleClosure,
} from "../../../src/core/second-nature/control-plane/cycle-finalizer.js";
import { writeLoopStageEvent } from "../../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function cycleRef(cycleId: string): SourceRef {
  return {
    uri: `sn://cycle/${cycleId}`,
    family: "action_closure",
    id: cycleId,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("T-AC.R.3 CycleFinalizer idempotency and reconcile", () => {
  it("first finalizeCycle for a cycle succeeds with closureRef", async () => {
    const db = createStateDatabase(":memory:");
    const result = await finalizeCycle(db, "cyc_idem_001", {
      kind: "no_action",
      reason: "proposal_no_action",
    });
    assert.ok(result.closureRef, "first finalize must return closureRef");
    assert.strictEqual(result.closureRef!.family, "action_closure");
    db.close();
  });

  it("duplicate finalizeCycle for same cycleId returns closure_idempotency_conflict (policy)", async () => {
    const db = createStateDatabase(":memory:");
    // First finalize — policy completed
    const first = await finalizeCycle(db, "cyc_idem_002", {
      kind: "policy",
      closureStatus: "completed",
      reason: "policy_allowed",
      proposalId: "prop_002",
      decisionId: "dec_002",
    });
    assert.ok(first.closureRef, "first finalize must succeed");

    // Second finalize — should be blocked
    const second = await finalizeCycle(db, "cyc_idem_002", {
      kind: "policy",
      closureStatus: "denied",
      reason: "policy_denied_high_risk",
      proposalId: "prop_002",
      decisionId: "dec_002_b",
    });
    assert.ok(second.degraded, "duplicate must return degraded");
    assert.strictEqual(second.degraded!.status, "unsafe");
    assert.strictEqual(second.degraded!.reason, "closure_idempotency_conflict");
    assert.ok(
      second.degraded!.operatorNextAction.includes("cyc_idem_002"),
      "operatorNextAction must mention the cycleId",
    );
    db.close();
  });

  it("duplicate finalizeCycle for same cycleId returns closure_idempotency_conflict (execution)", async () => {
    const db = createStateDatabase(":memory:");
    // First finalize — execution completed
    const first = await finalizeCycle(db, "cyc_idem_003", {
      kind: "execution",
      closureStatus: "completed",
      reason: "execution_completed",
      proposalId: "prop_003",
      decisionId: "dec_003",
      executionResultRef: "sn://connector_result/exec_003",
      outputSummary: "reply posted",
    });
    assert.ok(first.closureRef, "first finalize must succeed");

    // Second finalize — should be blocked
    const second = await finalizeCycle(db, "cyc_idem_003", {
      kind: "execution",
      closureStatus: "failed",
      reason: "execution_failed",
      proposalId: "prop_003",
      decisionId: "dec_003",
      executionResultRef: "sn://connector_result/exec_003_b",
    });
    assert.ok(second.degraded, "duplicate must return degraded");
    assert.strictEqual(second.degraded!.status, "unsafe");
    assert.strictEqual(second.degraded!.reason, "closure_idempotency_conflict");
    db.close();
  });

  it("reconcileCycleClosure returns consistent when closure and event both exist", async () => {
    const db = createStateDatabase(":memory:");
    // Write closure
    await finalizeCycle(db, "cyc_rec_001", {
      kind: "no_action",
      reason: "proposal_no_action",
    });
    // Write closure stage event
    await writeLoopStageEvent(db, {
      id: "evt_cyc_rec_001_closure",
      cycleId: "cyc_rec_001",
      cycleSequence: 1,
      stage: "closure",
      status: "completed",
      occurredAt: new Date().toISOString(),
      sourceRefs: [cycleRef("cyc_rec_001")],
    });
    const result = await reconcileCycleClosure(db, "cyc_rec_001");
    assert.ok(result.consistent, "cycle with both closure and event must be consistent");
    db.close();
  });

  it("reconcileCycleClosure detects orphaned closure (event missing)", async () => {
    const db = createStateDatabase(":memory:");
    // Write closure only — no stage event
    await finalizeCycle(db, "cyc_rec_002", {
      kind: "no_action",
      reason: "proposal_no_action",
    });
    const result = await reconcileCycleClosure(db, "cyc_rec_002");
    assert.ok(!result.consistent, "orphaned closure must be detected");
    assert.ok(result.orphanedClosure, "orphanedClosure must be set");
    assert.strictEqual(result.orphanedClosure!.cycleId, "cyc_rec_002");
    db.close();
  });

  it("reconcileCycleClosure detects orphaned event (closure missing)", async () => {
    const db = createStateDatabase(":memory:");
    // Write closure stage event only — no closure row
    await writeLoopStageEvent(db, {
      id: "evt_cyc_rec_003_closure",
      cycleId: "cyc_rec_003",
      cycleSequence: 1,
      stage: "closure",
      status: "completed",
      occurredAt: new Date().toISOString(),
      sourceRefs: [cycleRef("cyc_rec_003")],
    });
    const result = await reconcileCycleClosure(db, "cyc_rec_003");
    assert.ok(!result.consistent, "orphaned event must be detected");
    assert.ok(result.orphanedEvent, "orphanedEvent must be set");
    assert.strictEqual(result.orphanedEvent!.cycleId, "cyc_rec_003");
    db.close();
  });

  it("reconcileCycleClosure returns consistent when neither closure nor event exists", async () => {
    const db = createStateDatabase(":memory:");
    const result = await reconcileCycleClosure(db, "cyc_rec_004");
    assert.ok(result.consistent, "empty cycle must be consistent (nothing to reconcile)");
    db.close();
  });
});
