import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import {
  decisionLedger as decisionLedgerTable,
  executionAttempts as executionAttemptsTable,
  governanceAudit as governanceAuditTable,
  redactionManifest as redactionManifestTable,
} from "../../../src/observability/db/schema/index.js";
import { DecisionLedger } from "../../../src/observability/services/decision-ledger.js";
import { GovernanceAudit } from "../../../src/observability/services/governance-audit.js";
import { ExecutionTelemetry } from "../../../src/observability/services/execution-telemetry.js";
import type { DecisionRecord, ExecutionAttempt, AnchorChangeAudit } from "../../../src/shared/types/continuity.js";

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
  const dbPath = path.join(os.tmpdir(), `observability-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  cleanupPaths.push(dbPath);
  const database = createObservabilityDatabase(dbPath);

  database.sqlite.exec(`
    CREATE TABLE decision_ledger (
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
    CREATE INDEX decision_tick_idx ON decision_ledger(tick_id);
    CREATE UNIQUE INDEX decision_trace_idx ON decision_ledger(trace_id);

    CREATE TABLE execution_attempts (
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
    CREATE UNIQUE INDEX attempt_trace_idx ON execution_attempts(trace_id);
    CREATE INDEX attempt_decision_idx ON execution_attempts(decision_id);
    CREATE INDEX attempt_platform_idx ON execution_attempts(platform_id);

    CREATE TABLE governance_audit (
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
    CREATE INDEX audit_proposal_idx ON governance_audit(proposal_id);
    CREATE INDEX audit_asset_idx ON governance_audit(target_asset_id);
    CREATE INDEX audit_event_idx ON governance_audit(event_type);

    CREATE TABLE redaction_manifest (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      action TEXT NOT NULL,
      original_value_hash TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX redact_event_idx ON redaction_manifest(event_id);
  `);

  return database;
}

test("DecisionLedger records decisions and append-style lifecycle events with redaction manifests", async () => {
  const db = createTempDb();
  const ledger = new DecisionLedger(db);

  const decision: DecisionRecord = {
    id: "decision-1",
    tickId: "tick-1",
    traceId: "trace-1",
    intentId: "intent-1",
    platformId: "instreet",
    verdict: "allow",
    mode: "active",
    reasons: ["policy_ok"],
    reasonCodes: ["policy_ok"],
    decisionBasis: "rule_only",
    evidenceRefs: ["asset:1"],
    createdAt: new Date().toISOString(),
  };

  await ledger.recordDecision(decision);
  await ledger.recordQuietLifecycle({
    id: "quiet-1",
    tickId: "tick-1",
    eventType: "quiet.entered",
    reason: "window_match",
    reflectionCandidates: ["memory:today"],
    createdAt: new Date().toISOString(),
  });
  await ledger.recordOutreachDecision({
    id: "outreach-1",
    tickId: "tick-2",
    eventType: "outreach.deferred",
    platformId: "instreet",
    targetUserId: "user-1",
    valueScore: 0.62,
    suppressionReason: "low_urgency",
    messagePreview: "hi there",
    createdAt: new Date().toISOString(),
  });

  const decisionRows = await db.db.select().from(decisionLedgerTable);
  assert.equal(decisionRows.length, 3);

  const queriedByTick = await ledger.queryByTickId("tick-1");
  assert.equal(queriedByTick.length, 2);

  const outreachDecision = await ledger.queryByTraceId("outreach-outreach.deferred-outreach-1");
  assert.ok(outreachDecision);
  assert.equal(outreachDecision.verdict, "defer");

  const manifests = await db.db.select().from(redactionManifestTable);
  assert.ok(manifests.length >= 1);
  assert.ok(manifests.some((row) => row.fieldName === "*" && row.action === "none"));

  db.close();
});

test("GovernanceAudit records anchor and credential events without collapsing platform identity", async () => {
  const db = createTempDb();
  const audit = new GovernanceAudit(db);

  const anchorEvent: AnchorChangeAudit = {
    id: "anchor-1",
    proposalId: "proposal-1",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    status: "applied",
    beforeHash: "before",
    afterHash: "after",
    supportingSources: ["memory:today"],
    reason: "approved update",
    appliedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await audit.recordAnchorChangeAudit(anchorEvent);
  await audit.recordCredentialLifecycle({
    id: "cred-1",
    platformId: "instreet",
    credentialId: "cred-instreet-1",
    statusFrom: "pending_verification",
    statusTo: "active",
    verificationDeadline: new Date().toISOString(),
    attemptsRemaining: 4,
    explanationCapsule: "verification successful",
    createdAt: new Date().toISOString(),
  });

  const anchorRows = await audit.queryByProposalId("proposal-1");
  assert.equal(anchorRows.length, 1);
  assert.equal(anchorRows[0]?.status, "applied");

  const credentialRows = await audit.queryCredentialByPlatform("instreet");
  assert.equal(credentialRows.length, 1);
  assert.equal(credentialRows[0]?.platformId, "instreet");
  assert.equal(credentialRows[0]?.credentialId, "cred-instreet-1");

  const redactions = await db.db.select().from(redactionManifestTable);
  assert.ok(redactions.length >= 1);

  db.close();
});

test("ExecutionTelemetry records attempts and updates commit state for replay analysis", async () => {
  const db = createTempDb();
  const telemetry = new ExecutionTelemetry(db);

  const attempt: ExecutionAttempt = {
    id: "attempt-1",
    traceId: "trace-telemetry-1",
    decisionId: "decision-telemetry-1",
    intentId: "intent-telemetry-1",
    platformId: "evomap",
    capability: "agent.heartbeat",
    channel: "api_rest",
    status: "started",
    commitState: "planned",
    retryPolicy: "none",
    idempotencyKey: "heartbeat-1",
    metadata: { node_secret: "should-mask" },
    startedAt: new Date().toISOString(),
  };

  await telemetry.recordExecutionAttempt(attempt);
  await telemetry.updateCommitState("trace-telemetry-1", "externally_acknowledged");
  await telemetry.completeAttempt("trace-telemetry-1", "succeeded", "committed");

  const queried = await telemetry.queryByTraceId("trace-telemetry-1");
  assert.ok(queried);
  assert.equal(queried.commitState, "committed");
  assert.equal(queried.status, "succeeded");

  const byDecision = await telemetry.queryByDecisionId("decision-telemetry-1");
  assert.equal(byDecision.length, 1);

  const byPlatform = await telemetry.queryByPlatform("evomap");
  assert.equal(byPlatform.length, 1);

  const byCommitState = await telemetry.queryByCommitState("committed");
  assert.equal(byCommitState.length, 1);

  const manifests = await db.db.select().from(redactionManifestTable);
  assert.ok(manifests.some((row) => row.fieldName === "metadata.node_secret" && row.action === "mask"));
  assert.ok(!manifests.some((row) => row.fieldName === "_none" && row.action === "mask"));

  db.close();
});
