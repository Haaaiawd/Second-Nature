import test from "node:test";
import assert from "node:assert/strict";

import { buildOutreachDraftRequest } from "../../../src/core/second-nature/outreach/build-outreach-draft-request.js";
import { draftOutreachMessage } from "../../../src/guidance/draft-outreach-message.js";
import { judgeOutreach } from "../../../src/core/second-nature/outreach/judge-outreach.js";
import { resolveDeliveryTarget } from "../../../src/core/second-nature/outreach/delivery-target.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { HeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
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

function makeSnapshot(ts: string): HeartbeatRuntimeSnapshot {
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

const baseCandidate: CandidateIntent = {
  id: "c-outreach-1",
  kind: "outreach",
  priority: 5,
  source: "tick",
  summary: "platform direction check-in",
  effectClass: "user_outreach",
  sourceRefs: [ref("src-1")],
};

test("T6.2.1 allow + target_available → sendable draft", async () => {
  const snapshot = makeSnapshot("2026-05-02T12:00:00.000Z");
  const judgment = judgeOutreach({
    candidate: baseCandidate,
    userInterest: {
      staleness: "fresh",
      confidence: 0.9,
      signals: [{ topic: "platform", confidence: 0.8, sourceRefs: [ref("int-1")] }],
      sourceRefs: [ref("int-1")],
    },
    lifeEvidence: { empty: false, evidenceRefCount: 2 },
    delivery: { target: "explicit", channel: "dm", recipient: "user-1" },
  });
  assert.equal(judgment.verdict, "allow");
  const delivery = resolveDeliveryTarget({ target: "explicit", channel: "dm", recipient: "user-1" });
  const req = buildOutreachDraftRequest(baseCandidate, judgment, snapshot, delivery);
  const draft = await draftOutreachMessage(req);
  assert.equal(draft.status, "ready");
  if (draft.status === "ready") {
    assert.equal(draft.draft.deliveryWording, "sendable");
    assert.ok(!draft.draft.text.toLowerCase().includes("not sent to the user"));
  }
});

test("T6.2.1 allow + target_none → fallback_candidate wording, never claims sent", async () => {
  const snapshot = makeSnapshot("2026-05-02T12:00:00.000Z");
  const judgment = judgeOutreach({
    candidate: baseCandidate,
    userInterest: {
      staleness: "fresh",
      confidence: 0.9,
      signals: [{ topic: "platform", confidence: 0.8, sourceRefs: [ref("int-1")] }],
      sourceRefs: [ref("int-1")],
    },
    lifeEvidence: { empty: false, evidenceRefCount: 2 },
    delivery: { target: "none" },
  });
  assert.equal(judgment.verdict, "allow");
  const delivery = resolveDeliveryTarget({ target: "none" });
  const req = buildOutreachDraftRequest(baseCandidate, judgment, snapshot, delivery);
  assert.equal(req.sceneType, "fallback_candidate");
  const draft = await draftOutreachMessage(req);
  assert.equal(draft.status, "ready");
  if (draft.status === "ready") {
    assert.equal(draft.draft.deliveryWording, "not_sent_fallback_candidate");
    assert.ok(draft.draft.text.toLowerCase().includes("not sent"));
  }
});

test("T6.2.1 deny judgment → hard_decision_not_allow", async () => {
  const snapshot = makeSnapshot("2026-05-02T12:00:00.000Z");
  const badCandidate: CandidateIntent = { ...baseCandidate, id: "c-bad", sourceRefs: [] };
  const judgment = judgeOutreach({
    candidate: badCandidate,
    userInterest: {
      staleness: "insufficient",
      confidence: 0,
      signals: [],
      sourceRefs: [],
    },
    lifeEvidence: { empty: true, evidenceRefCount: 0 },
    delivery: { target: "explicit", channel: "dm", recipient: "u" },
  });
  assert.notEqual(judgment.verdict, "allow");
  const delivery = resolveDeliveryTarget({ target: "explicit", channel: "dm", recipient: "u" });
  const req = buildOutreachDraftRequest(badCandidate, judgment, snapshot, delivery);
  const draft = await draftOutreachMessage(req);
  assert.equal(draft.status, "unavailable");
  if (draft.status === "unavailable") {
    assert.ok(draft.reasons.includes("hard_decision_not_allow"));
  }
});
