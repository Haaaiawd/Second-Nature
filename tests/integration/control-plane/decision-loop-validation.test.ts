import test from "node:test";
import assert from "node:assert/strict";

import {
  EffectDispatcher,
  LeaseManager,
  resumeFromCheckpoint,
  type ContinuitySnapshot,
  type RhythmPolicy,
} from "../../../src/core/second-nature/index.js";
import {
  createObservabilityDatabase,
  DecisionLedger,
  EvidenceQueryEngine,
  ExecutionTelemetry,
} from "../../../src/observability/index.js";
import { createEffectCommitStore, createStateDatabase } from "../../../src/storage/index.js";
import { createDecisionCycleHarness } from "./_helpers/decision-cycle-harness.js";

function setupObservability() {
  const db = createObservabilityDatabase(":memory:");
  db.sqlite.exec(`
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
  return db;
}

test("whole-loop validation covers active/quiet/interrupt/outreach/deny and durability+explainability chain", async () => {
  const obsDb = setupObservability();
  const decisionLedger = new DecisionLedger(obsDb);
  const telemetry = new ExecutionTelemetry(obsDb);
  const evidenceQuery = new EvidenceQueryEngine(obsDb);
  const stateDb = createStateDatabase(":memory:");
  stateDb.sqlite.exec(`
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
  `);
  const commitStore = createEffectCommitStore(stateDb.db as any);

  const rhythmPolicy: RhythmPolicy = {
    timezone: "UTC",
    quietSuppressionEnabled: true,
    windows: [
      { id: "active-window", startMinute: 0, endMinute: 1320, mode: "active" },
      { id: "quiet-window", startMinute: 1320, endMinute: 1440, mode: "quiet" },
    ],
  };

  const checkpoints = new Map<string, { id: string; intentId: string; snapshotRef: string }>();
  const snapshots = new Map<string, Record<string, unknown>>();

  const dispatcher = new EffectDispatcher(
    new LeaseManager(),
    {
      async createIntentCommitRecord(input) {
        const record = await commitStore.createIntentCommitRecord(input as any);
        return { id: record.id };
      },
      async advanceIntentCommitState(id, state, metadata) {
        await commitStore.advanceIntentCommitState(id, state as any, metadata);
      },
      async commitIntentOutcome(id, outcome) {
        await commitStore.commitIntentOutcome(id, outcome);
      },
      async abortIntentCommit(id, reason) {
        await commitStore.abortIntentCommit(id, reason);
      },
    },
    {
      async executeEffect(input) {
        await telemetry.recordExecutionAttempt({
          id: `attempt:${input.intentId}`,
          traceId: `trace:${input.decisionId}`,
          decisionId: input.decisionId,
          intentId: input.intentId,
          platformId: input.platformId,
          capability: input.intent,
          channel: "api_rest",
          status: "succeeded",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
        return {
          status: "success",
          data: { ok: true },
          metadata: {
            platformId: input.platformId,
            channel: "api_rest",
            latencyMs: 1,
          },
        };
      },
    },
    {
      async saveCheckpoint(input) {
        checkpoints.set(input.id, { id: input.id, intentId: input.intentId, snapshotRef: input.snapshotRef });
      },
    },
    {
      async persistCurationResult() {
        return;
      },
    },
    {
      async runNarrativeReflection() {
        return { outcomeRef: "reflection-artifact" };
      },
    }
  );

  const harness = createDecisionCycleHarness({
    rhythmPolicy,
    decisionLedger,
    effectDispatcher: dispatcher,
    outreachModel: {
      async evaluateOutreachCandidate() {
        return {
          valueScore: 0.9,
          novelty: 0.8,
          userRelevance: 0.9,
          actionability: 0.8,
          urgency: 0.7,
          requiredUserHelp: true,
          isRoutineProgress: false,
          minThreshold: 0.65,
          sourceRefs: ["report:1"],
        };
      },
    },
  });

  const activeSnapshot: ContinuitySnapshot = {
    mode: "active",
    currentWindowId: "active-window",
    pendingObligations: ["heartbeat"],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 3 },
  };

  const activeDispatch = await harness.ingestTick(
    { id: "tick-active", source: "cron", receivedAt: "2026-03-25T09:00:00.000Z" },
    activeSnapshot
  );
  assert.equal(activeDispatch.status, "effect_executed");
  assert.ok(activeDispatch.decisionId);
  assert.ok(activeDispatch.intentId);

  const quietAllowSnapshot: ContinuitySnapshot = {
    ...activeSnapshot,
    mode: "quiet",
    deniedIntents: [],
    awaitingUserInput: false,
    pendingObligations: [],
    budgets: { socialUsed: 99, socialLimit: 1 },
    recentOutreachHashes: [
      "intent-outreach",
      "intent-outreach|consider proactive user outreach",
    ],
  };
  const quietAllowResult = await harness.ingestTick(
    { id: "tick-quiet-allow", source: "heartbeat", receivedAt: "2026-03-25T22:10:00.000Z" },
    quietAllowSnapshot
  );
  assert.equal(quietAllowResult.status, "maintenance_done");

  const quietAllowEvidence = await evidenceQuery.queryEvidence({ decisionId: quietAllowResult.decisionId! });
  assert.equal(quietAllowEvidence.decisions.length, 1);
  assert.equal(quietAllowEvidence.decisions[0]?.mode, "quiet");
  assert.equal(quietAllowEvidence.decisions[0]?.verdict, "allow");
  assert.equal(quietAllowEvidence.decisions[0]?.decisionBasis, "rule_only");

  const quietAllowCommit = await commitStore.loadIntentCommitRecord(quietAllowResult.intentId!);
  assert.equal(quietAllowCommit?.state, "committed");

  const denySnapshot: ContinuitySnapshot = {
    ...activeSnapshot,
    mode: "quiet",
    deniedIntents: [],
    awaitingUserInput: false,
    pendingObligations: ["urgent-obligation"],
  };
  const denyResult = await harness.ingestTick(
    { id: "tick-deny", source: "heartbeat", receivedAt: "2026-03-25T22:20:00.000Z" },
    denySnapshot
  );
  assert.notEqual(denyResult.status, "effect_executed");
  const denyDecisions = await decisionLedger.queryByTickId("tick-deny");
  const denyDecision = denyDecisions.find((item) => item.verdict === "deny");
  assert.ok(denyDecision);

  const interruptSnapshot: ContinuitySnapshot = {
    ...activeSnapshot,
    mode: "paused_for_interrupt",
  };
  const interruptResult = await harness.ingestTick(
    { id: "tick-interrupt", source: "user_interrupt", receivedAt: "2026-03-25T09:30:00.000Z" },
    interruptSnapshot
  );
  assert.equal(interruptResult.status, "interrupt_deferred");

  const outreachSnapshot: ContinuitySnapshot = {
    ...activeSnapshot,
    mode: "active",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [
      { intentHash: "exploration:scan platform opportunities", reason: "duplicate_intent", at: "now" },
      { intentHash: "social:engage social platforms", reason: "duplicate_intent", at: "now" },
    ],
  };
  const outreachResult = await harness.ingestTick(
    { id: "tick-outreach", source: "cron", receivedAt: "2026-03-25T10:00:00.000Z" },
    outreachSnapshot
  );
  assert.ok(outreachResult.status === "outreach_allowed" || outreachResult.status === "outreach_denied");
  assert.ok(outreachResult.decisionId);

  const evidence = await evidenceQuery.queryEvidence({ decisionId: activeDispatch.decisionId! });
  assert.equal(evidence.decisions.length, 1);
  assert.equal(evidence.attempts.length, 1);
  assert.equal(evidence.decisions[0]?.verdict, "allow");
  assert.ok((evidence.decisions[0]?.reasonCodes ?? []).includes("guard_clear"));

  const denyEvidence = await evidenceQuery.queryEvidence({ decisionId: denyDecision!.id });
  assert.equal(denyEvidence.decisions.length, 1);
  assert.equal(denyEvidence.decisions[0]?.verdict, "deny");
  assert.ok(
    (denyEvidence.decisions[0]?.reasonCodes ?? []).some(
      (c) => c.includes("quiet_window") || c.includes("quiet_window_suppression"),
    ),
  );

  const outreachEvidence = await evidenceQuery.queryEvidence({ decisionId: outreachResult.decisionId! });
  assert.equal(outreachEvidence.decisions.length, 1);
  assert.equal(outreachEvidence.decisions[0]?.decisionBasis, "model_assisted");

  const committed = await commitStore.loadIntentCommitRecord(activeDispatch.intentId!);
  assert.equal(committed?.state, "committed");

  const activeTrace = evidence.decisions[0]?.traceId ?? "";
  snapshots.set(activeTrace, { mode: "active", tickId: "tick-active" });

  const activeCheckpointId = `checkpoint:${activeDispatch.intentId}:tick-active`;

  const resumeAlreadyCommitted = await resumeFromCheckpoint(
    {
      async loadCheckpoint(checkpointId: string) {
        return checkpoints.get(checkpointId) ?? null;
      },
      async loadIntentCommitRecord(intentId: string) {
        const rec = await commitStore.loadIntentCommitRecord(intentId);
        return rec ? { id: rec.id, intentId: rec.intentId, state: rec.state as any, outcomeRef: rec.outcomeRef } : null;
      },
      async loadSnapshotByRef(snapshotRef: string) {
        return snapshots.get(snapshotRef) ?? {};
      },
    },
    activeCheckpointId
  );
  assert.equal(resumeAlreadyCommitted.status, "already_committed");

  checkpoints.set("checkpoint-reconcile", {
    id: "checkpoint-reconcile",
    intentId: "intent-reconcile",
    snapshotRef: "snapshot-reconcile",
  });
  const recRecord = await commitStore.createIntentCommitRecord({
    intentId: "intent-reconcile",
    decisionId: "decision-reconcile",
    checkpointId: "checkpoint-reconcile",
    state: "planned",
  } as any);
  await commitStore.advanceIntentCommitState(recRecord.id, "dispatched");
  await commitStore.advanceIntentCommitState(recRecord.id, "externally_acknowledged", {
    outcomeRef: "outcome-ack",
  });
  snapshots.set("snapshot-reconcile", { mode: "active", tickId: "tick-reconcile" });

  const resumeNeedsReconcile = await resumeFromCheckpoint(
    {
      async loadCheckpoint(checkpointId: string) {
        return checkpoints.get(checkpointId) ?? null;
      },
      async loadIntentCommitRecord(intentId: string) {
        const rec = await commitStore.loadIntentCommitRecord(intentId);
        return rec ? { id: rec.id, intentId: rec.intentId, state: rec.state as any, outcomeRef: rec.outcomeRef } : null;
      },
      async loadSnapshotByRef(snapshotRef: string) {
        return snapshots.get(snapshotRef) ?? {};
      },
    },
    "checkpoint-reconcile"
  );
  assert.equal(resumeNeedsReconcile.status, "needs_reconcile");

  checkpoints.set("checkpoint-ready", {
    id: "checkpoint-ready",
    intentId: "intent-ready",
    snapshotRef: "snapshot-ready",
  });
  await commitStore.createIntentCommitRecord({
    intentId: "intent-ready",
    decisionId: "decision-ready",
    checkpointId: "checkpoint-ready",
    state: "planned",
  } as any);
  snapshots.set("snapshot-ready", { mode: "quiet", tickId: "tick-ready" });

  const resumeReady = await resumeFromCheckpoint(
    {
      async loadCheckpoint(checkpointId: string) {
        return checkpoints.get(checkpointId) ?? null;
      },
      async loadIntentCommitRecord(intentId: string) {
        const rec = await commitStore.loadIntentCommitRecord(intentId);
        return rec ? { id: rec.id, intentId: rec.intentId, state: rec.state as any, outcomeRef: rec.outcomeRef } : null;
      },
      async loadSnapshotByRef(snapshotRef: string) {
        return snapshots.get(snapshotRef) ?? {};
      },
    },
    "checkpoint-ready"
  );
  assert.equal(resumeReady.status, "ready_to_resume");

  stateDb.close();
  obsDb.close();
});
