import test from "node:test";
import assert from "node:assert/strict";

import { dispatchUserOutreachIntent } from "../../../src/core/second-nature/outreach/dispatch-user-outreach.js";
import { createDraftOutreachMessagePort } from "../../../src/guidance/draft-outreach-message.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { listDeliveryAttemptsByDecisionId } from "../../../src/storage/delivery/query-delivery-attempts.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";

const ref = (id: string) =>
  ({
    id,
    family: "evidence" as const,
    uri: `https://example.test/${id}`,
    redactionClass: "none" as const,
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
  id: "c-del-fail",
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

test("T2.3.2 delivery failed writes attempt + operator fallback and returns delivery_unavailable", async () => {
  const state = createStateDatabase(":memory:");
  const guidance = createDraftOutreachMessagePort();
  const result = await dispatchUserOutreachIntent({
    candidate,
    snapshot: makeSnapshot("2026-05-02T14:00:00.000Z"),
    judgeInput: judgeBase,
    guidance,
    delivery: {
      sendDeliveryRequest: async () => ({
        id: "att-failed-1",
        status: "failed",
        errorClass: "transport_failure",
      }),
    },
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  assert.ok(result.fallbackRef?.startsWith("fallback:"));
  assert.equal(result.deliveryAttemptId, "att-failed-1");
  const rows = await listDeliveryAttemptsByDecisionId(state, result.decisionId!);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].fallbackRef, result.fallbackRef);
  state.close();
});

test("T2.3.2 host sent without messageId or hostProofRef is delivery_unavailable with delivery_proof_missing", async () => {
  const state = createStateDatabase(":memory:");
  const guidance = createDraftOutreachMessagePort();
  const result = await dispatchUserOutreachIntent({
    candidate: { ...candidate, id: "c-no-proof" },
    snapshot: makeSnapshot("2026-05-02T14:10:00.000Z"),
    judgeInput: judgeBase,
    guidance,
    delivery: {
      sendDeliveryRequest: async () => ({
        id: "att-no-proof",
        status: "sent",
      }),
    },
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  assert.ok(result.fallbackRef?.startsWith("fallback:"));
  const rows = await listDeliveryAttemptsByDecisionId(state, result.decisionId!);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].errorClass, "delivery_proof_missing");
  state.close();
});

test("T2.3.2 dropped_by_host_policy writes attempt + fallback", async () => {
  const state = createStateDatabase(":memory:");
  const guidance = createDraftOutreachMessagePort();
  const result = await dispatchUserOutreachIntent({
    candidate: { ...candidate, id: "c-drop" },
    snapshot: makeSnapshot("2026-05-02T14:05:00.000Z"),
    judgeInput: judgeBase,
    guidance,
    delivery: {
      sendDeliveryRequest: async () => ({
        id: "att-drop-1",
        status: "dropped_by_host_policy",
        errorClass: "dropped_by_host_policy",
      }),
    },
    state,
  });

  assert.equal(result.status, "delivery_unavailable");
  const rows = await listDeliveryAttemptsByDecisionId(state, result.decisionId!);
  assert.equal(rows[0].status, "dropped_by_host_policy");
  state.close();
});
