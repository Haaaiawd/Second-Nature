import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { DecisionLedger, type HeartbeatDecisionEvent } from "../../../src/observability/services/decision-ledger.js";

const cleanupPaths: string[] = [];
const openDbs: Array<{ close: () => void }> = [];

afterEach(() => {
  // Close all open database connections first
  while (openDbs.length > 0) {
    const db = openDbs.pop();
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  // Then clean up files
  while (cleanupPaths.length > 0) {
    const target = cleanupPaths.pop();
    if (target && fs.existsSync(target)) {
      try {
        fs.rmSync(target, { force: true });
      } catch {
        // Ignore cleanup errors on Windows
      }
    }
  }
});

function createTempDb() {
  const dbPath = path.join(os.tmpdir(), `observability-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  cleanupPaths.push(dbPath);
  const database = createObservabilityDatabase(dbPath);

  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS decision_ledger (
      id TEXT PRIMARY KEY,
      tick_id TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      intent_id TEXT,
      platform_id TEXT,
      verdict TEXT NOT NULL,
      mode TEXT NOT NULL,
      reasons TEXT NOT NULL,
      reason_codes TEXT NOT NULL,
      decision_basis TEXT NOT NULL,
      evidence_refs TEXT NOT NULL,
      model_eval_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redaction_manifest (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      action TEXT NOT NULL,
      original_value_hash TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const ledger = new DecisionLedger(database);
  openDbs.push(database);
  return { db: database, ledger, dbPath };
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const target = cleanupPaths.pop();
    if (target && fs.existsSync(target)) {
      try {
        fs.rmSync(target, { force: true });
      } catch {
        // Ignore cleanup errors on Windows
      }
    }
  }
});

// ─── T5.1.1: Heartbeat Decision Record Tests ────────────────────────────────

test("T5.1.1 heartbeat_ok leaves a queryable record", async () => {
  const { ledger } = createTempDb();

  const event: HeartbeatDecisionEvent = {
    id: "hb-ok-1",
    tickId: "tick-1",
    traceId: "trace-hb-ok-1",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "heartbeat_ok",
    reasons: ["no_candidates"],
    mode: "active",
    createdAt: "2026-03-31T10:00:00Z",
  };

  await ledger.recordHeartbeatDecision(event);

  const records = await ledger.queryByTickId("tick-1");
  assert.equal(records.length, 1);

  const record = records[0];
  assert.equal(record.verdict, "defer");
  assert.ok(record.reasons.includes("no_candidates"));
  assert.ok(record.evidenceRefs.some((r) => r.includes("scope:rhythm")));
  assert.ok(record.evidenceRefs.some((r) => r.includes("trigger:heartbeat_bridge")));
  assert.ok(record.evidenceRefs.some((r) => r.includes("status:heartbeat_ok")));
});

test("T5.1.1 denied leaves a queryable record", async () => {
  const { ledger } = createTempDb();

  const event: HeartbeatDecisionEvent = {
    id: "hb-deny-1",
    tickId: "tick-2",
    traceId: "trace-hb-deny-1",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "denied",
    reasons: ["intent-obligation:deny(awaiting_user)"],
    mode: "active",
    createdAt: "2026-03-31T10:30:00Z",
  };

  await ledger.recordHeartbeatDecision(event);

  const records = await ledger.queryByTickId("tick-2");
  assert.equal(records.length, 1);

  const record = records[0];
  assert.equal(record.verdict, "deny");
  assert.ok(record.reasons.includes("intent-obligation:deny(awaiting_user)"));
  assert.ok(record.evidenceRefs.some((r) => r.includes("status:denied")));
});

test("T5.1.1 intent_selected (allow) leaves a queryable record", async () => {
  const { ledger } = createTempDb();

  const event: HeartbeatDecisionEvent = {
    id: "hb-allow-1",
    tickId: "tick-3",
    traceId: "trace-hb-allow-1",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "intent_selected",
    reasons: [],
    intentId: "intent-obligation-0",
    mode: "active",
    createdAt: "2026-03-31T11:00:00Z",
  };

  await ledger.recordHeartbeatDecision(event);

  const records = await ledger.queryByTickId("tick-3");
  assert.equal(records.length, 1);

  const record = records[0];
  assert.equal(record.verdict, "allow");
  assert.equal(record.intentId, "intent-obligation-0");
  assert.ok(record.evidenceRefs.some((r) => r.includes("status:intent_selected")));
});

test("T5.1.1 record distinguishes runtimeScope, triggerSource, decisionStatus, reasons", async () => {
  const { ledger } = createTempDb();

  await ledger.recordHeartbeatDecision({
    id: "hb-multi-ok",
    tickId: "tick-multi",
    traceId: "trace-hb-multi-ok",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "heartbeat_ok",
    reasons: ["no_candidates"],
    mode: "quiet",
    createdAt: "2026-03-31T12:00:00Z",
  });

  await ledger.recordHeartbeatDecision({
    id: "hb-multi-deny",
    tickId: "tick-multi",
    traceId: "trace-hb-multi-deny",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "denied",
    reasons: ["budget_exceeded", "awaiting_user"],
    mode: "active",
    createdAt: "2026-03-31T12:30:00Z",
  });

  await ledger.recordHeartbeatDecision({
    id: "hb-multi-allow",
    tickId: "tick-multi",
    traceId: "trace-hb-multi-allow",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "intent_selected",
    reasons: [],
    intentId: "intent-social-0",
    mode: "active",
    createdAt: "2026-03-31T13:00:00Z",
  });

  const records = await ledger.queryByTickId("tick-multi");
  assert.equal(records.length, 3);

  const okRecord = records.find((r) => r.evidenceRefs.some((e) => e.includes("status:heartbeat_ok")));
  const denyRecord = records.find((r) => r.evidenceRefs.some((e) => e.includes("status:denied")));
  const allowRecord = records.find((r) => r.evidenceRefs.some((e) => e.includes("status:intent_selected")));

  assert.ok(okRecord, "heartbeat_ok record should exist");
  assert.ok(denyRecord, "denied record should exist");
  assert.ok(allowRecord, "intent_selected record should exist");

  for (const record of records) {
    assert.ok(record.evidenceRefs.some((e) => e.startsWith("scope:")), "should have runtimeScope");
    assert.ok(record.evidenceRefs.some((e) => e.startsWith("trigger:")), "should have triggerSource");
    assert.ok(record.evidenceRefs.some((e) => e.startsWith("status:")), "should have decisionStatus");
  }

  assert.ok(Array.isArray(denyRecord?.reasons), "reasons should be an array");
  assert.ok(denyRecord?.reasons.includes("budget_exceeded"), "reasons should contain budget_exceeded");
  assert.ok(denyRecord?.reasons.includes("awaiting_user"), "reasons should contain awaiting_user");
});

test("T5.1.1 deferred verdict leaves a queryable record", async () => {
  const { ledger } = createTempDb();

  const event: HeartbeatDecisionEvent = {
    id: "hb-defer-1",
    tickId: "tick-4",
    traceId: "trace-hb-defer-1",
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus: "deferred",
    reasons: ["lease_unavailable"],
    mode: "active",
    createdAt: "2026-03-31T13:30:00Z",
  };

  await ledger.recordHeartbeatDecision(event);

  const records = await ledger.queryByTickId("tick-4");
  assert.equal(records.length, 1);

  const record = records[0];
  assert.equal(record.verdict, "defer");
  assert.ok(record.evidenceRefs.some((r) => r.includes("status:deferred")));
});
