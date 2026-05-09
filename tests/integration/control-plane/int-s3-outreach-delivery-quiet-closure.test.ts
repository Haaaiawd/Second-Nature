/**
 * INT-S3 — S3 closure: source-backed outreach → draft → delivery failure semantics,
 * lived-experience audit + verifyAuditHashChain + explain, Quiet empty path, S2 touch.
 *
 * Uses in-memory state + fake delivery only (no OpenClaw E2E).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";

import { dispatchUserOutreachIntent } from "../../../src/core/second-nature/outreach/dispatch-user-outreach.js";
import { buildOutreachDraftRequest } from "../../../src/core/second-nature/outreach/build-outreach-draft-request.js";
import { judgeOutreach } from "../../../src/core/second-nature/outreach/judge-outreach.js";
import { resolveDeliveryTarget } from "../../../src/core/second-nature/outreach/delivery-target.js";
import { createDraftOutreachMessagePort } from "../../../src/guidance/draft-outreach-message.js";
import { draftOutreachMessage } from "../../../src/guidance/draft-outreach-message.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { operatorFallbackArtifacts } from "../../../src/storage/db/schema/operator-fallback-artifacts.js";
import { listDeliveryAttemptsByDecisionId } from "../../../src/storage/delivery/query-delivery-attempts.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import {
  verifyAuditHashChain,
  createAppendOnlyAuditStoreRangeLoader,
} from "../../../src/observability/audit/verify-audit-hash-chain.js";
import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";
import {
  ingestRhythmSignal,
  type HeartbeatSignal,
  type HeartbeatDeps,
} from "../../../src/core/second-nature/heartbeat/index.js";

const ref = (id: string) =>
  ({
    id,
    kind: "platform_item" as const,
    uri: `https://example.test/${id}`,
  }) satisfies CandidateIntent["sourceRefs"][number];

function makeSnapshot(ts: string) {
  const inputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "win_work_morning",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    lifeEvidenceRefs: [ref("ev-1")],
    duplicateIntentKeys: [],
    outreachCooldownKeys: [],
  };
  const continuity = buildContinuitySnapshot(inputs);
  return buildHeartbeatRuntimeSnapshot(ts, inputs, continuity);
}

const candidate: CandidateIntent = {
  id: "c-int-s3",
  kind: "outreach",
  priority: 5,
  source: "tick",
  summary: "platform direction check-in",
  effectClass: "user_outreach",
  sourceRefs: [ref("src-1")],
};

const judgeBase = {
  userInterest: {
    staleness: "fresh" as const,
    confidence: 0.9,
    signals: [{ topic: "platform", confidence: 0.8, sourceRefs: [ref("int-1")] }],
    sourceRefs: [ref("int-1")],
  },
  lifeEvidence: { empty: false, evidenceRefCount: 2 },
  delivery: { target: "explicit" as const, channel: "dm", recipient: "user-1" },
};

test("INT-S3: source-backed draft (T6.2.1) → delivery failed → not_sent fallback + audit chain + explain", async () => {
  const state = createStateDatabase(":memory:");
  const guidance = createDraftOutreachMessagePort();
  const snapshot = makeSnapshot("2026-05-02T16:00:00.000Z");
  const judgment = judgeOutreach({ ...judgeBase, candidate });
  assert.equal(judgment.verdict, "allow");
  const deliveryRes = resolveDeliveryTarget(judgeBase.delivery);
  const req = buildOutreachDraftRequest(candidate, judgment, snapshot, deliveryRes);
  const preDraft = await draftOutreachMessage(req);
  assert.equal(preDraft.status, "ready");
  if (preDraft.status === "ready") {
    assert.equal(preDraft.draft.deliveryWording, "sendable");
    assert.ok(
      !/has been sent to the user|successfully delivered to the user/i.test(preDraft.draft.text),
      "pre-send draft must not claim user-visible delivery",
    );
  }

  const auditTs = "2026-05-02T16:00:00.000Z";
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  const result = await dispatchUserOutreachIntent({
    candidate,
    snapshot,
    judgeInput: judgeBase,
    guidance,
    delivery: {
      sendDeliveryRequest: async () => ({
        id: "att-int-s3-fail",
        status: "failed",
        errorClass: "transport_failure",
      }),
    },
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  assert.ok(result.fallbackRef?.startsWith("fallback:"));
  const fbRows = await state.db
    .select()
    .from(operatorFallbackArtifacts)
    .where(eq(operatorFallbackArtifacts.fallbackRef, result.fallbackRef!));
  assert.equal(fbRows[0]?.status, "not_sent");
  assert.ok(
    !(fbRows[0]?.candidateMessage ?? "").toLowerCase().includes("has been sent to the user"),
    "fallback copy must not impersonate delivered-to-user",
  );

  recorder.recordDecisionTrace({
    decisionId: result.decisionId!,
    traceId: "trace-int-s3",
    runtimeScope: "rhythm",
    outcome: "delivery_unavailable",
    selectedIntentId: candidate.id,
    reasonCodes: result.reasons,
    sourceRefs: [ref("ev-1")],
    createdAt: auditTs,
  });
  recorder.recordDeliveryAudit({
    auditId: "da-int-s3-fail",
    decisionId: result.decisionId!,
    traceId: "trace-int-s3",
    status: "failed",
    fallbackRef: result.fallbackRef,
    reasonCodes: ["delivery_failed"],
    createdAt: auditTs,
  });

  const vr = await verifyAuditHashChain(
    { from: "2026-05-02T15:00:00.000Z", to: "2026-05-02T23:59:59.000Z" },
    createAppendOnlyAuditStoreRangeLoader(store),
  );
  assert.equal(vr.status, "pass", JSON.stringify(vr));
  assert.deepEqual(vr.reasons, ["hash_chain_valid"]);

  const explain = recorder.explainLinkageForDecision(result.decisionId!);
  assert.ok(explain.warnings.includes("no_user_visible_contact_claim_prohibited"));
  assert.equal(explain.deliveryStatus, "failed");

  const attempts = await listDeliveryAttemptsByDecisionId(state, result.decisionId!);
  assert.equal(attempts[0]?.status, "failed");
  state.close();
});

test("INT-S3: dropped_by_host_policy → delivery_unavailable + audit not_sent semantics", async () => {
  const state = createStateDatabase(":memory:");
  const guidance = createDraftOutreachMessagePort();
  const snapshot = makeSnapshot("2026-05-02T16:30:00.000Z");
  const auditTs = "2026-05-02T16:30:00.000Z";
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  const result = await dispatchUserOutreachIntent({
    candidate: { ...candidate, id: "c-int-s3-drop" },
    snapshot,
    judgeInput: judgeBase,
    guidance,
    delivery: {
      sendDeliveryRequest: async () => ({
        id: "att-int-s3-drop",
        status: "dropped_by_host_policy",
        errorClass: "dropped_by_host_policy",
      }),
    },
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  const fbRows = await state.db
    .select()
    .from(operatorFallbackArtifacts)
    .where(eq(operatorFallbackArtifacts.fallbackRef, result.fallbackRef!));
  assert.equal(fbRows[0]?.status, "not_sent");

  recorder.recordDecisionTrace({
    decisionId: result.decisionId!,
    traceId: "trace-int-s3b",
    runtimeScope: "rhythm",
    outcome: "delivery_unavailable",
    selectedIntentId: "c-int-s3-drop",
    reasonCodes: result.reasons,
    sourceRefs: [],
    createdAt: auditTs,
  });
  recorder.recordDeliveryAudit({
    auditId: "da-int-s3-drop",
    decisionId: result.decisionId!,
    traceId: "trace-int-s3b",
    status: "failed",
    fallbackRef: result.fallbackRef,
    reasonCodes: ["dropped_by_host_policy"],
    createdAt: auditTs,
  });

  const vr = await verifyAuditHashChain(
    { from: "2026-05-02T16:00:00.000Z", to: "2026-05-02T17:00:00.000Z" },
    createAppendOnlyAuditStoreRangeLoader(store),
  );
  assert.equal(vr.status, "pass");
  assert.deepEqual(vr.reasons, ["hash_chain_valid"]);

  const explain = recorder.explainLinkageForDecision(result.decisionId!);
  assert.ok(explain.warnings.includes("no_user_visible_contact_claim_prohibited"));

  const attempts = await listDeliveryAttemptsByDecisionId(state, result.decisionId!);
  assert.equal(attempts[0]?.status, "dropped_by_host_policy");
  state.close();
});

test("INT-S3 Quiet regression: quiet mode persists empty_state artifact (T2.3.3 / T4.4.1)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-int-s3-quiet-"));
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T22:30:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    quietEnabledBridge: true,
  };
  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => snapshotInputs,
    quietWorkflow: { workspaceRoot: tmp },
  };
  const result = await ingestRhythmSignal(signal, deps);
  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.some((x) => x.includes("quiet_empty_state") || x.includes("no_fictional")));
  const quietDir = path.join(tmp, ".second-nature", "quiet", "2026-05-02");
  assert.ok(fs.existsSync(quietDir));
  assert.ok(fs.readdirSync(quietDir).some((f) => f.endsWith(".json")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("INT-S3 S2 touch: active rhythm heartbeat reaches intent_selected (obligations path)", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T09:00:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "window-default",
    pendingObligations: ["check-email"],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
    awaitingUserInput: false,
  };
  const result = await ingestRhythmSignal(signal, {
    loadSnapshotInputs: async () => snapshotInputs,
  });
  assert.equal(result.status, "intent_selected");
  assert.ok(result.selectedIntentId?.length);
});
