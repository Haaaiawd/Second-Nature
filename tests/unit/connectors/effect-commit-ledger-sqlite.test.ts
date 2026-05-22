/**
 * EffectCommitLedger SQLite tests — T-CS.C.2
 *
 * Coverage:
 * - getOrCreateIntentCommitRecord creates on first call
 * - getOrCreateIntentCommitRecord returns existing on duplicate key
 * - markCommitted transitions state and stores outcomeRef
 * - Process restart: existing key is found and returned as existing=true
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { createEffectCommitLedgerSQLite } from "../../../src/connectors/base/effect-commit-ledger-sqlite.js";

describe("EffectCommitLedgerSQLite", () => {
  it("creates record on first getOrCreate", async () => {
    const db = createStateDatabase(":memory:");
    const ledger = createEffectCommitLedgerSQLite(db);

    const result = await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-1",
      effectClass: "side_effect",
    });

    assert.strictEqual(result.existing, false);
    assert.strictEqual(result.record.state, "planned");
    assert(result.record.id !== undefined);
    db.close();
  });

  it("returns existing on duplicate idempotency key", async () => {
    const db = createStateDatabase(":memory:");
    const ledger = createEffectCommitLedgerSQLite(db);

    await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-2",
      effectClass: "side_effect",
    });

    const second = await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-2",
      effectClass: "side_effect",
    });

    assert.strictEqual(second.existing, true);
    assert.strictEqual(second.record.state, "planned");
    db.close();
  });

  it("markCommitted transitions state and stores outcomeRef", async () => {
    const db = createStateDatabase(":memory:");
    const ledger = createEffectCommitLedgerSQLite(db);

    await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-3",
      effectClass: "side_effect",
    });

    const commit = await ledger.markCommitted("idem-3", "outcome://ref-1");
    assert.strictEqual(commit.ok, true);
    assert.strictEqual(commit.previousState, "planned");

    const after = await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-3",
      effectClass: "side_effect",
    });
    assert.strictEqual(after.existing, true);
    assert.strictEqual(after.record.state, "committed");
    assert.strictEqual(after.record.outcomeRef, "outcome://ref-1");
    db.close();
  });

  it("markCommitted returns ok:false for unknown key", async () => {
    const db = createStateDatabase(":memory:");
    const ledger = createEffectCommitLedgerSQLite(db);

    const commit = await ledger.markCommitted("unknown", "outcome://ref");
    assert.strictEqual(commit.ok, false);
    db.close();
  });

  it("survives new ledger instance (process restart simulation)", async () => {
    const db = createStateDatabase(":memory:");
    const ledger = createEffectCommitLedgerSQLite(db);

    await ledger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-restart",
      effectClass: "side_effect",
    });
    await ledger.markCommitted("idem-restart", "outcome://survived");

    // Simulate process restart by creating a new ledger instance on the same DB
    const newLedger = createEffectCommitLedgerSQLite(db);
    const afterRestart = await newLedger.getOrCreateIntentCommitRecord({
      decisionId: "dec-1",
      intentId: "intent-1",
      idempotencyKey: "idem-restart",
      effectClass: "side_effect",
    });

    assert.strictEqual(afterRestart.existing, true);
    assert.strictEqual(afterRestart.record.state, "committed");
    assert.strictEqual(afterRestart.record.outcomeRef, "outcome://survived");
    db.close();
  });
});
