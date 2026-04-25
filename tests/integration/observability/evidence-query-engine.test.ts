import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { EvidenceQueryEngine } from "../../../src/observability/query/evidence-query-engine.js";
import { decisionLedger, executionAttempts, governanceAudit } from "../../../src/observability/db/schema/index.js";

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const target = cleanupPaths.pop();
    if (target && fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }
});

function createTempDb() {
  const dbPath = path.join(os.tmpdir(), `observability-evidence-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
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

    CREATE TABLE IF NOT EXISTS execution_attempts (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      decision_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      commit_state TEXT,
      failure_class TEXT,
      retry_policy TEXT,
      idempotency_key TEXT,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS governance_audit (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      proposal_id TEXT,
      target_asset_id TEXT,
      asset_path TEXT,
      status_from TEXT,
      status_to TEXT NOT NULL,
      before_hash TEXT,
      after_hash TEXT,
      supporting_sources TEXT,
      reason TEXT,
      verification_deadline TEXT,
      attempts_remaining INTEGER,
      created_at TEXT NOT NULL
    );
  `);

  return database;
}

test("queryEvidence by decisionId only returns decision and attempts bound to that decision", async () => {
  const db = createTempDb();
  const engine = new EvidenceQueryEngine(db);

  await db.db.insert(decisionLedger).values({
    id: "decision-1",
    tickId: "tick-1",
    traceId: "trace-1",
    intentId: "intent-1",
    platformId: "instreet",
    verdict: "allow",
    mode: "active",
    reasons: JSON.stringify(["policy_ok"]),
    reasonCodes: JSON.stringify(["policy_ok"]),
    decisionBasis: "rule_only",
    evidenceRefs: JSON.stringify(["content_ref:day/1"]),
    modelEvalRef: null,
    createdAt: new Date().toISOString(),
  });

  await db.db.insert(executionAttempts).values({
    id: "attempt-1",
    traceId: "trace-1",
    decisionId: "decision-1",
    intentId: "intent-1",
    platformId: "instreet",
    capability: "feed.read",
    channel: "api",
    status: "succeeded",
    commitState: "committed",
    failureClass: null,
    retryPolicy: null,
    idempotencyKey: null,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  });

  await db.db.insert(executionAttempts).values({
    id: "attempt-2",
    traceId: "trace-2",
    decisionId: "decision-2",
    intentId: "intent-2",
    platformId: "evomap",
    capability: "agent.heartbeat",
    channel: "api",
    status: "failed",
    commitState: "aborted",
    failureClass: "timeout",
    retryPolicy: null,
    idempotencyKey: null,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  });

  await db.db.insert(governanceAudit).values({
    id: "gov-1",
    eventType: "anchor.applied",
    proposalId: "proposal-1",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    statusFrom: "approved",
    statusTo: "applied",
    beforeHash: "h1",
    afterHash: "h2",
    supportingSources: JSON.stringify(["content_ref:day/1"]),
    reason: "approved",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: new Date().toISOString(),
  });

  await db.db.insert(governanceAudit).values({
    id: "gov-2",
    eventType: "anchor.applied",
    proposalId: "proposal-2",
    targetAssetId: "OTHER.md",
    assetPath: "workspace/OTHER.md",
    statusFrom: "approved",
    statusTo: "applied",
    beforeHash: "x1",
    afterHash: "x2",
    supportingSources: JSON.stringify(["content_ref:other"]),
    reason: "other",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: new Date().toISOString(),
  });

  const bundle = await engine.queryEvidence({ decisionId: "decision-1" });

  assert.deepEqual(bundle.plan.path, ["decision", "attempts"]);
  assert.equal(bundle.decisions.length, 1);
  assert.equal(bundle.attempts.length, 1);
  assert.equal(bundle.attempts[0]?.decisionId, "decision-1");
  assert.equal(bundle.governance.length, 0);
  assert.ok(bundle.explanation.evidenceRefs.includes("content_ref:day/1"));

  db.close();
});

test("queryEvidence by proposalId and assetId only returns matching governance records", async () => {
  const db = createTempDb();
  const engine = new EvidenceQueryEngine(db);

  await db.db.insert(governanceAudit).values({
    id: "gov-3",
    eventType: "anchor.applied",
    proposalId: "proposal-2",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    statusFrom: "approved",
    statusTo: "applied",
    beforeHash: "hb",
    afterHash: "ha",
    supportingSources: JSON.stringify(["content_ref:day/2"]),
    reason: "apply ok",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: new Date().toISOString(),
  });

  await db.db.insert(governanceAudit).values({
    id: "gov-4",
    eventType: "anchor.rejected",
    proposalId: "proposal-3",
    targetAssetId: "OTHER.md",
    assetPath: "workspace/OTHER.md",
    statusFrom: "requires_review",
    statusTo: "rejected",
    beforeHash: "o1",
    afterHash: null,
    supportingSources: JSON.stringify(["content_ref:day/3"]),
    reason: "rejected",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: new Date().toISOString(),
  });

  const byProposal = await engine.queryEvidence({ proposalId: "proposal-2" });
  assert.deepEqual(byProposal.plan.path, ["anchor_audit"]);
  assert.equal(byProposal.governance.length, 1);
  assert.equal(byProposal.governance[0]?.proposalId, "proposal-2");

  const byAsset = await engine.queryEvidence({ assetId: "SOUL.md" });
  assert.deepEqual(byAsset.plan.path, ["anchor_audit"]);
  assert.equal(byAsset.governance.length, 1);
  assert.equal(byAsset.governance[0]?.targetAssetId, "SOUL.md");

  assert.equal(byAsset.decisions.length, 0);
  assert.equal(byAsset.attempts.length, 0);

  db.close();
});

test("queryEvidence with sessionId is explicitly unsupported", async () => {
  const db = createTempDb();
  const engine = new EvidenceQueryEngine(db);

  await assert.rejects(
    () => engine.queryEvidence({ sessionId: "session-1" }),
    /evidence_query_sessionId_unsupported/
  );

  await assert.rejects(
    () => engine.queryEvidence({}),
    /evidence_query_requires_index_key/
  );

  db.close();
});
