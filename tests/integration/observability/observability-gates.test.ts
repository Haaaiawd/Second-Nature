import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { DecisionLedger } from "../../../src/observability/services/decision-ledger.js";
import { GovernanceAudit } from "../../../src/observability/services/governance-audit.js";
import { ExecutionTelemetry } from "../../../src/observability/services/execution-telemetry.js";
import { EvidenceQueryEngine } from "../../../src/observability/query/evidence-query-engine.js";
import {
  decisionLedger as decisionLedgerTable,
  governanceAudit as governanceAuditTable,
  redactionManifest as redactionManifestTable,
  executionAttempts as executionAttemptsTable,
} from "../../../src/observability/db/schema/index.js";
import type { AnchorChangeAudit, DecisionRecord, ExecutionAttempt } from "../../../src/shared/types/continuity.js";

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
  const dbPath = path.join(os.tmpdir(), `observability-gates-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
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

  return database;
}

test("quality gate: deny path is recorded and queryable", async () => {
  const db = createTempDb();
  const ledger = new DecisionLedger(db);
  const queryEngine = new EvidenceQueryEngine(db);

  const denyDecision: DecisionRecord = {
    id: "decision-deny-1",
    tickId: "tick-deny-1",
    traceId: "trace-deny-1",
    intentId: "intent-deny-1",
    platformId: "instreet",
    verdict: "deny",
    mode: "active",
    reasons: ["quiet_window"],
    reasonCodes: ["quiet_window"],
    decisionBasis: "rule_only",
    evidenceRefs: ["content_ref:quiet/1"],
    createdAt: new Date().toISOString(),
  };

  await ledger.recordDecision(denyDecision);

  const rows = await db.db.select().from(decisionLedgerTable);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.verdict, "deny");

  const bundle = await queryEngine.queryEvidence({ decisionId: "decision-deny-1" });
  assert.equal(bundle.decisions.length, 1);
  assert.equal(bundle.decisions[0]?.verdict, "deny");

  db.close();
});

test("quality gate: anchor audit preserves before/after hash diff evidence", async () => {
  const db = createTempDb();
  const governance = new GovernanceAudit(db);

  const anchorEvent: AnchorChangeAudit = {
    id: "anchor-audit-1",
    proposalId: "proposal-audit-1",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    status: "applied",
    beforeHash: "before-hash",
    afterHash: "after-hash",
    supportingSources: ["content_ref:day/10"],
    reason: "approved update",
    createdAt: new Date().toISOString(),
  };

  await governance.recordAnchorChangeAudit(anchorEvent);

  const rows = await db.db.select().from(governanceAuditTable);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.proposalId, "proposal-audit-1");
  assert.equal(rows[0]?.beforeHash, "before-hash");
  assert.equal(rows[0]?.afterHash, "after-hash");

  db.close();
});

test("quality gate: credential lifecycle audit is persisted and retrievable by platform", async () => {
  const db = createTempDb();
  const governance = new GovernanceAudit(db);

  await governance.recordCredentialLifecycle({
    id: "cred-audit-1",
    platformId: "instreet",
    credentialId: "cred-instreet-1",
    statusFrom: "pending_verification",
    statusTo: "active",
    verificationDeadline: new Date().toISOString(),
    attemptsRemaining: 2,
    explanationCapsule: "verification completed",
    createdAt: new Date().toISOString(),
  });

  const records = await governance.queryCredentialByPlatform("instreet");
  assert.equal(records.length, 1);
  assert.equal(records[0]?.statusTo, "active");
  assert.equal(records[0]?.credentialId, "cred-instreet-1");

  db.close();
});

test("quality gate: evidence query links decision and execution attempt", async () => {
  const db = createTempDb();
  const ledger = new DecisionLedger(db);
  const telemetry = new ExecutionTelemetry(db);
  const queryEngine = new EvidenceQueryEngine(db);

  await ledger.recordDecision({
    id: "decision-link-1",
    tickId: "tick-link-1",
    traceId: "trace-link-1",
    intentId: "intent-link-1",
    platformId: "evomap",
    verdict: "allow",
    mode: "active",
    reasons: ["policy_ok"],
    reasonCodes: ["policy_ok"],
    decisionBasis: "rule_only",
    evidenceRefs: ["content_ref:link/1"],
    createdAt: new Date().toISOString(),
  });

  const attempt: ExecutionAttempt = {
    id: "attempt-link-1",
    traceId: "trace-link-1",
    decisionId: "decision-link-1",
    intentId: "intent-link-1",
    platformId: "evomap",
    capability: "agent.heartbeat",
    channel: "api_rest",
    status: "succeeded",
    commitState: "committed",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };

  await telemetry.recordExecutionAttempt(attempt);

  const bundle = await queryEngine.queryEvidence({ decisionId: "decision-link-1" });
  assert.equal(bundle.decisions.length, 1);
  assert.equal(bundle.attempts.length, 1);
  assert.equal(bundle.attempts[0]?.decisionId, "decision-link-1");
  assert.equal(bundle.governance.length, 0);

  db.close();
});

test("quality gate: redaction security prevents sensitive plaintext from landing", async () => {
  const db = createTempDb();
  const telemetry = new ExecutionTelemetry(db);

  const attempt: ExecutionAttempt = {
    id: "attempt-redact-1",
    traceId: "trace-redact-1",
    decisionId: "decision-redact-1",
    intentId: "intent-redact-1",
    platformId: "evomap",
    capability: "agent.register",
    channel: "api_rest",
    status: "started",
    commitState: "planned",
    metadata: {
      node_secret: "plaintext-should-not-persist",
    },
    startedAt: new Date().toISOString(),
  };

  await telemetry.recordExecutionAttempt(attempt);

  const attemptRows = await db.db.select().from(executionAttemptsTable);
  assert.equal(attemptRows.length, 1);
  assert.equal(attemptRows[0]?.id, "attempt-redact-1");

  const redactionRows = await db.db.select().from(redactionManifestTable);
  assert.ok(redactionRows.some((row) => row.fieldName === "metadata.node_secret" && row.action === "mask"));
  assert.ok(!redactionRows.some((row) => row.fieldName.includes("node_secret") && row.action === "none"));

  db.close();
});
