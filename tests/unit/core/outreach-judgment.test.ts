import test from "node:test";
import assert from "node:assert/strict";

import { resolveDeliveryTarget } from "../../../src/core/second-nature/outreach/delivery-target.js";
import { judgeOutreach, type JudgeOutreachInput } from "../../../src/core/second-nature/outreach/judge-outreach.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";

const baseCandidate = (): CandidateIntent => ({
  id: "c1",
  kind: "outreach",
  priority: 5,
  source: "tick",
  summary: "Discuss project alpha with you",
  effectClass: "user_outreach",
  sourceRefs: [
    {
      id: "ref1",
      kind: "platform_item",
      uri: "https://example.com/p/1",
    },
  ],
});

function baseInput(over: Partial<JudgeOutreachInput> = {}): JudgeOutreachInput {
  return {
    candidate: baseCandidate(),
    userInterest: {
      staleness: "fresh",
      confidence: 0.8,
      signals: [
        {
          topic: "project alpha",
          confidence: 0.9,
          sourceRefs: [{ id: "sig1", kind: "user_anchor", uri: "file:///USER.md" }],
        },
      ],
      sourceRefs: [],
    },
    lifeEvidence: { empty: false, evidenceRefCount: 4 },
    delivery: { target: "explicit", channel: "dm", recipient: "user-1" },
    ...over,
  };
}

test("resolveDeliveryTarget: target_none", () => {
  const r = resolveDeliveryTarget({ target: "none" });
  assert.equal(r.verdict, "target_none");
});

test("resolveDeliveryTarget: explicit missing channel -> channel_missing", () => {
  const r = resolveDeliveryTarget({ target: "explicit", channel: "", recipient: "u" });
  assert.equal(r.verdict, "channel_missing");
});

test("resolveDeliveryTarget: explicit ok", () => {
  const r = resolveDeliveryTarget({ target: "explicit", channel: "dm", recipient: "u" });
  assert.equal(r.verdict, "target_available");
  assert.equal(r.channel, "dm");
});

test("resolveDeliveryTarget: last without lastKnownVisibleChannel", () => {
  const r = resolveDeliveryTarget({ target: "last" });
  assert.equal(r.verdict, "channel_missing");
});

test("judgeOutreach: allow when delivery available and scores ok", () => {
  const j = judgeOutreach(baseInput());
  assert.equal(j.verdict, "allow");
  assert.equal(j.deliveryVerdict, "target_available");
});

test("judgeOutreach: deny on missing sources", () => {
  const c = baseCandidate();
  c.sourceRefs = [];
  const j = judgeOutreach(baseInput({ candidate: c }));
  assert.equal(j.verdict, "deny");
  assert.ok(j.reasons.includes("missing_source_refs"));
});

test("judgeOutreach: target_none still allow judgment but marks delivery verdict", () => {
  const j = judgeOutreach(baseInput({ delivery: { target: "none" } }));
  assert.equal(j.deliveryVerdict, "target_none");
  assert.equal(j.verdict, "allow");
  assert.ok(j.reasons.includes("target_none"));
});

test("judgeOutreach: defer on duplicate", () => {
  const j = judgeOutreach(baseInput({ duplicateBlocked: true }));
  assert.equal(j.verdict, "defer");
  assert.equal(j.cooldownState, "duplicate");
});

test("judgeOutreach: defer on cooldown", () => {
  const j = judgeOutreach(baseInput({ cooldownBlocked: true }));
  assert.equal(j.verdict, "defer");
});

test("judgeOutreach: insufficient interest and low actionability -> deny", () => {
  const j = judgeOutreach(
    baseInput({
      userInterest: {
        staleness: "insufficient",
        confidence: 0,
        signals: [],
        sourceRefs: [],
      },
      candidate: {
        ...baseCandidate(),
        summary: "random unrelated text xyzabc",
      },
    }),
  );
  assert.equal(j.verdict, "deny");
  assert.ok(j.reasons.includes("not_interest_relevant_or_actionable"));
});

test("judgeOutreach: low outreach value score -> deny with value_score_too_low (CH-09-06)", () => {
  const c = baseCandidate();
  c.priority = 0;
  const j = judgeOutreach(
    baseInput({
      candidate: c,
      lifeEvidence: { empty: true, evidenceRefCount: 0 },
    }),
  );
  assert.equal(j.verdict, "deny");
  assert.ok(j.reasons.includes("value_score_too_low"));
});
