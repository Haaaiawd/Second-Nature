import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createCliRuntimeDeps,
  createCommandRouter,
  closeCliRuntimeDeps,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { decisionLedger, executionAttempts, governanceAudit } from "../../../src/observability/db/schema/index.js";
import { resolveDailyReportPath } from "../../../src/storage/memory/workspace/paths.js";

beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "abcdefghijklmnopqrstuvwxyz123456";
});

const STATE_TEST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS credential_records (
    platform_id TEXT PRIMARY KEY,
    credential_type TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    status TEXT NOT NULL,
    verification_code TEXT,
    challenge_text TEXT,
    expires_at TEXT,
    attempts_remaining INTEGER,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policy_records (
    platform_id TEXT PRIMARY KEY,
    social_daily_limit INTEGER NOT NULL,
    quiet_enabled INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asset_registry (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    layer TEXT NOT NULL,
    last_indexed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS intent_commit_records (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    checkpoint_id TEXT,
    state TEXT NOT NULL,
    outcome_ref TEXT,
    metadata_json TEXT,
    updated_at TEXT NOT NULL
  );
`;

const OBSERVABILITY_TEST_SCHEMA = `
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
  CREATE UNIQUE INDEX IF NOT EXISTS decision_trace_idx ON decision_ledger(trace_id);
  CREATE INDEX IF NOT EXISTS decision_tick_idx ON decision_ledger(tick_id);
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
  CREATE UNIQUE INDEX IF NOT EXISTS attempt_trace_idx ON execution_attempts(trace_id);
  CREATE INDEX IF NOT EXISTS attempt_decision_idx ON execution_attempts(decision_id);
  CREATE INDEX IF NOT EXISTS attempt_platform_idx ON execution_attempts(platform_id);
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
  CREATE INDEX IF NOT EXISTS audit_proposal_idx ON governance_audit(proposal_id);
  CREATE INDEX IF NOT EXISTS audit_asset_idx ON governance_audit(target_asset_id);
  CREATE INDEX IF NOT EXISTS audit_event_idx ON governance_audit(event_type);
  CREATE TABLE IF NOT EXISTS redaction_manifest (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    action TEXT NOT NULL,
    original_value_hash TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS redact_event_idx ON redaction_manifest(event_id);
`;

function applyCliOpsTestSchema(runtime: ReturnType<typeof createCliRuntimeDeps>) {
  runtime.stateDb.sqlite.exec(STATE_TEST_SCHEMA);
  runtime.observabilityDb.sqlite.exec(OBSERVABILITY_TEST_SCHEMA);
}

function buildRuntimeAndRouter() {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const statePath = path.join(os.tmpdir(), `sn-cli-state-${unique}.db`);
  const obsPath = path.join(os.tmpdir(), `sn-cli-obs-${unique}.db`);

  const seededRuntime = createCliRuntimeDeps({
    stateDb: createStateDatabase(statePath),
    observabilityDb: createObservabilityDatabase(obsPath),
  });

  applyCliOpsTestSchema(seededRuntime);

  const router = createCommandRouter({ deps: seededRuntime });
  return {
    runtime: seededRuntime,
    router,
    cleanup() {
      closeCliRuntimeDeps(seededRuntime);
      if (fs.existsSync(statePath)) fs.rmSync(statePath, { force: true });
      if (fs.existsSync(obsPath)) fs.rmSync(obsPath, { force: true });
    },
  };
}

function getCommand(router: ReturnType<typeof createCommandRouter>, name: string) {
  const command = router.resolve(name);
  assert.ok(command, `command ${name} should exist`);
  return command;
}

test("T5.1.2 status/report/quiet/session/credential commands return aggregated read models", async () => {
  const harness = buildRuntimeAndRouter();

  await harness.runtime.stateApi.credentials.saveCredentialContext({
    platformId: "instreet",
    credentialType: "api_key",
    encryptedValue: "encrypted",
    status: "pending_verification",
    verificationCode: "1234",
    challengeText: "challenge",
    expiresAt: "2026-03-25T10:00:00.000Z",
    attemptsRemaining: 2,
  });

  const reportPath = resolveDailyReportPath("2026-03-25");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    [
      "# Daily Report — 2026-03-25",
      "",
      "## Summary",
      "Seeded summary",
      "",
      "## Highlights",
      "- H1",
      "",
      "## Sources",
      "- Activities: a1",
      "- Observations: o1",
    ].join("\n"),
    "utf-8"
  );

  const now = new Date().toISOString();
  await harness.runtime.observabilityDb.db.insert(decisionLedger).values({
    id: "decision-runtime",
    tickId: "tick-runtime",
    traceId: "sn-runtime-register-1",
    intentId: "intent-runtime",
    platformId: null,
    verdict: "defer",
    mode: "active",
    reasons: JSON.stringify(["origin:register"]),
    reasonCodes: JSON.stringify(["heartbeat_decision"]),
    decisionBasis: "rule_only",
    evidenceRefs: JSON.stringify(["scope:rhythm", "trigger:heartbeat_bridge", "status:heartbeat_ok"]),
    modelEvalRef: null,
    createdAt: now,
  });

  await harness.runtime.observabilityDb.db.insert(executionAttempts).values({
    id: "attempt-runtime",
    traceId: "sn-runtime-register-1",
    decisionId: "decision-runtime",
    intentId: "intent-runtime",
    platformId: "second-nature-runtime",
    capability: "runtime.activate",
    channel: "plugin_host",
    status: "succeeded",
    commitState: "committed",
    failureClass: null,
    retryPolicy: null,
    idempotencyKey: null,
    startedAt: now,
    finishedAt: now,
  });

  await harness.runtime.observabilityDb.db.insert(decisionLedger).values({
    id: "decision-status",
    tickId: "tick-status",
    traceId: "trace-session-1",
    intentId: "intent-1",
    platformId: "instreet",
    verdict: "allow",
    mode: "active",
    reasons: JSON.stringify(["policy_ok"]),
    reasonCodes: JSON.stringify(["policy_ok"]),
    decisionBasis: "rule_only",
    evidenceRefs: JSON.stringify(["content_ref:status"]),
    modelEvalRef: null,
    createdAt: now,
  });

  await harness.runtime.observabilityDb.db.insert(executionAttempts).values({
    id: "attempt-status",
    traceId: "trace-session-1",
    decisionId: "decision-status",
    intentId: "intent-1",
    platformId: "instreet",
    capability: "feed.read",
    channel: "api_rest",
    status: "succeeded",
    commitState: "committed",
    failureClass: null,
    retryPolicy: null,
    idempotencyKey: null,
    startedAt: now,
    finishedAt: now,
  });

  await harness.runtime.observabilityDb.db.insert(governanceAudit).values({
    id: "gov-session-1",
    eventType: "anchor.applied",
    proposalId: "proposal-1",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    statusFrom: "approved",
    statusTo: "applied",
    beforeHash: "h1",
    afterHash: "h2",
    supportingSources: JSON.stringify(["content_ref:status"]),
    reason: "seed",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: now,
  });

  const status = getCommand(harness.router, "status");
  const report = getCommand(harness.router, "report");
  const quiet = getCommand(harness.router, "quiet");
  const session = getCommand(harness.router, "session");
  const credential = getCommand(harness.router, "credential");

  const statusResult = await status.execute({});
  assert.equal(statusResult.ok, true);
  assert.equal((statusResult as any).data.runtime.host, "openclaw-plugin");
  assert.equal((statusResult as any).data.runtime.serviceStatus, "running");
  assert.equal((statusResult as any).data.credentials[0].platformId, "instreet");
  assert.equal((statusResult as any).data.credentials[0].status, "pending_verification");

  const reportResult = await report.execute({ day: "2026-03-25" });
  assert.equal(reportResult.ok, true);
  assert.equal((reportResult as any).data.day, "2026-03-25");
  assert.equal((reportResult as any).data.summary, "Seeded summary");
  assert.deepEqual((reportResult as any).data.highlights, ["H1"]);

  const quietResult = await quiet.execute({ scope: "recent" });
  assert.equal(quietResult.ok, true);
  assert.equal((quietResult as any).data.scope, "recent");
  assert.equal((quietResult as any).data.mode, "unknown");

  const sessionMissing = await session.execute({});
  assert.equal(sessionMissing.ok, false);
  assert.deepEqual((sessionMissing as any).error.requiredUserInput, ["session_id"]);

  const sessionResult = await session.execute({ sessionId: "trace-session-1" });
  assert.equal(sessionResult.ok, true);
  assert.equal((sessionResult as any).data.requestedSessionId, "trace-session-1");
  assert.equal((sessionResult as any).data.traceId, "trace-session-1");
  assert.equal((sessionResult as any).data.decisionCount, 1);
  assert.equal((sessionResult as any).data.attemptCount, 1);
  assert.equal((sessionResult as any).data.governanceCount, 0);

  const credentialShow = await credential.execute({ platformId: "instreet" });
  assert.equal(credentialShow.ok, true);
  assert.equal((credentialShow as any).data.platformId, "instreet");
  assert.equal((credentialShow as any).data.status, "pending_verification");

  harness.cleanup();
});

test("T5.2.1 explain command routes subject and returns structured explanation", async () => {
  const harness = buildRuntimeAndRouter();
  const explain = getCommand(harness.router, "explain");

  const now = new Date().toISOString();
  await harness.runtime.observabilityDb.db.insert(decisionLedger).values({
    id: "decision-explain-1",
    tickId: "tick-explain-1",
    traceId: "trace-explain-1",
    intentId: "intent-explain-1",
    platformId: "instreet",
    verdict: "allow",
    mode: "active",
    reasons: JSON.stringify(["reason"]),
    reasonCodes: JSON.stringify(["policy_ok", "value_high"]),
    decisionBasis: "rule_only",
    evidenceRefs: JSON.stringify(["content_ref:decision:1"]),
    modelEvalRef: null,
    createdAt: now,
  });

  await harness.runtime.observabilityDb.db.insert(governanceAudit).values({
    id: "gov-explain-1",
    eventType: "anchor.applied",
    proposalId: "proposal-explain",
    targetAssetId: "SOUL.md",
    assetPath: "workspace/SOUL.md",
    statusFrom: "approved",
    statusTo: "applied",
    beforeHash: "b1",
    afterHash: "a1",
    supportingSources: JSON.stringify(["content_ref:soul:1"]),
    reason: "seed",
    verificationDeadline: null,
    attemptsRemaining: null,
    createdAt: now,
  });

  const missing = await explain.execute({});
  assert.equal(missing.ok, false);
  assert.deepEqual((missing as any).error.requiredUserInput, ["subject"]);

  const unsupported = await explain.execute({ subject: "unknown:1" });
  assert.equal(unsupported.ok, false);
  assert.equal((unsupported as any).error.code, "EXPLAIN_SUBJECT_UNSUPPORTED");

  const decisionExplain = await explain.execute({ subject: "decision:decision-explain-1" });
  assert.equal(decisionExplain.ok, true);
  assert.equal((decisionExplain as any).data.subjectType, "decision");
  assert.ok((decisionExplain as any).data.keyFactors.includes("policy_ok"));

  const soulExplain = await explain.execute({ subject: "soul:SOUL.md" });
  assert.equal(soulExplain.ok, true);
  assert.equal((soulExplain as any).data.subjectType, "soul-change");
  assert.ok((soulExplain as any).data.evidenceRefs.includes("content_ref:soul:1"));

  harness.cleanup();
});

test("T5.2.2 policy set and credential verify return requiredUserInput for non-interactive recovery", async () => {
  const harness = buildRuntimeAndRouter();
  const policy = getCommand(harness.router, "policy");
  const credential = getCommand(harness.router, "credential");

  await harness.runtime.stateApi.credentials.saveCredentialContext({
    platformId: "instreet",
    credentialType: "api_key",
    encryptedValue: "encrypted",
    status: "pending_verification",
    verificationCode: "pending",
    challengeText: "challenge",
    expiresAt: "2026-03-25T10:00:00.000Z",
    attemptsRemaining: 3,
  });

  const policyMissing = await policy.execute({ action: "set", platformId: "instreet" });
  assert.equal(policyMissing.ok, false);
  assert.deepEqual((policyMissing as any).error.requiredUserInput, ["social_daily_limit", "quiet_enabled"]);

  const policyOk = await policy.execute({
    action: "set",
    platformId: "instreet",
    socialDailyLimit: 8,
    quietEnabled: true,
  });
  assert.equal(policyOk.ok, true);

  const savedPolicy = await harness.runtime.stateApi.read.loadPolicy("instreet");
  assert.ok(savedPolicy);
  assert.equal(savedPolicy?.socialDailyLimit, 8);
  assert.equal(savedPolicy?.quietEnabled, true);

  const verifyMissing = await credential.execute({ action: "verify", platformId: "instreet" });
  assert.equal(verifyMissing.ok, false);
  assert.deepEqual((verifyMissing as any).error.requiredUserInput, ["verification_answer"]);

  const verifyOk = await credential.execute({ action: "verify", platformId: "instreet", answer: "4321" });
  assert.equal(verifyOk.ok, true);

  const savedCredential = await harness.runtime.stateApi.credentials.loadCredentialContext("instreet") as any;
  assert.equal(savedCredential?.status, "active");
  assert.equal(savedCredential?.verificationCode, "4321");

  harness.cleanup();
});

test("flush-after-mutating-ops: heartbeat_check writes are visible to a new router", async () => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const statePath = path.join(os.tmpdir(), `sn-cli-state-flush-${unique}.db`);
  const obsPath = path.join(os.tmpdir(), `sn-cli-obs-flush-${unique}.db`);

  const firstRuntime = createCliRuntimeDeps({
    stateDb: createStateDatabase(statePath),
    observabilityDb: createObservabilityDatabase(obsPath),
  });
  applyCliOpsTestSchema(firstRuntime);
  const firstRouter = createCommandRouter({ deps: firstRuntime });

  const heartbeat = getCommand(firstRouter, "heartbeat_check");
  const heartbeatResult = await heartbeat.execute({ v8SpineEnabled: true });
  assert.equal(heartbeatResult.ok, true);

  closeCliRuntimeDeps(firstRuntime);

  const secondRuntime = createCliRuntimeDeps({
    stateDb: createStateDatabase(statePath),
    observabilityDb: createObservabilityDatabase(obsPath),
  });
  const secondRouter = createCommandRouter({ deps: secondRuntime });
  const loopStatus = getCommand(secondRouter, "loop_status");
  const statusResult = await loopStatus.execute({});
  assert.equal(statusResult.ok, true);
  assert.ok(
    (statusResult as any).data.stageSummaries.length >= 1,
    "loop_status should see stages after heartbeat_check flush",
  );
  assert.ok(
    (statusResult as any).data.lastCycleSequence >= 1,
    "loop_status should see cycle sequence after heartbeat_check flush",
  );

  closeCliRuntimeDeps(secondRuntime);
  if (fs.existsSync(statePath)) fs.rmSync(statePath, { force: true });
  if (fs.existsSync(obsPath)) fs.rmSync(obsPath, { force: true });
});

test("setup_hint and setup_ack CLI parity", async () => {
  const harness = buildRuntimeAndRouter();
  const setupHint = getCommand(harness.router, "setup_hint");
  const setupAck = getCommand(harness.router, "setup_ack");

  const hintResult = await setupHint.execute({});
  assert.equal(hintResult.ok, true);
  assert.ok((hintResult as any).data.skill || (hintResult as any).data.guide || (hintResult as any).data.nextStep);

  const ackResult = await setupAck.execute({ acceptedBy: "test", placedIn: "test-anchor" });
  assert.equal(ackResult.ok, true);
  assert.equal((ackResult as any).data.status, "acknowledged");
  assert.ok((ackResult as any).data.markerPath);

  const markerPath = (ackResult as any).data.markerPath as string;
  assert.ok(fs.existsSync(markerPath));

  harness.cleanup();
});

test("narrative:diff auto-resolves last two versions", async () => {
  const harness = buildRuntimeAndRouter();
  const snapshotCapture = getCommand(harness.router, "snapshot:capture");
  const narrativeDiff = getCommand(harness.router, "narrative:diff");

  const firstCapture = await snapshotCapture.execute({ subjectId: "narrative-diff-test-1" });
  assert.equal(firstCapture.ok, true);
  const secondCapture = await snapshotCapture.execute({ subjectId: "narrative-diff-test-2" });
  assert.equal(secondCapture.ok, true);

  const diffResult = await narrativeDiff.execute({});
  assert.equal(diffResult.ok, true);
  assert.ok((diffResult as any).data.fromVersion);
  assert.ok((diffResult as any).data.toVersion);
  assert.ok(Array.isArray((diffResult as any).data.changes));

  harness.cleanup();
});

test("narrative:diff with <2 timeline versions returns friendly error", async () => {
  const harness = buildRuntimeAndRouter();
  const narrativeDiff = getCommand(harness.router, "narrative:diff");

  const diffResult = await narrativeDiff.execute({});
  assert.equal(diffResult.ok, false);
  assert.equal((diffResult as any).error.code, "NARRATIVE_DIFF_REQUIRES_TWO_VERSIONS");
  assert.ok((diffResult as any).error.nextStep.includes("snapshot_capture"));

  harness.cleanup();
});
