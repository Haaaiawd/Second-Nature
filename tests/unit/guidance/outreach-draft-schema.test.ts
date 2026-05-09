import test from "node:test";
import assert from "node:assert/strict";

import {
  parseOutreachDraftRequest,
  safeParseOutreachDraftRequest,
} from "../../../src/guidance/outreach-draft-schema.js";

const validBase = {
  requestId: "req-1",
  sceneType: "outreach",
  runtimeScope: "rhythm",
  riskLevel: "medium",
  sourceRefs: [{ id: "s1", kind: "platform_item", uri: "https://x/y" }],
  decisionId: "dec-1",
  candidateId: "cand-1",
  judgmentVerdict: "allow",
  valueScore: 0.82,
  interestRefs: [{ id: "i1", kind: "user_anchor", uri: "file:///USER.md" }],
  deliveryContext: {
    deliveryVerdict: "target_available",
    wordingMode: "sendable",
  },
};

test("T6.1.1 parseOutreachDraftRequest accepts full contract", () => {
  const p = parseOutreachDraftRequest(validBase);
  assert.equal(p.decisionId, "dec-1");
  assert.equal(p.judgmentVerdict, "allow");
  assert.equal(p.valueScore, 0.82);
  assert.equal(p.deliveryContext?.wordingMode, "sendable");
});

test("T6.1.1 fallback_candidate with not_sent wording", () => {
  const p = parseOutreachDraftRequest({
    ...validBase,
    sceneType: "fallback_candidate",
    deliveryContext: {
      deliveryVerdict: "target_none",
      wordingMode: "not_sent_fallback_candidate",
    },
  });
  assert.equal(p.sceneType, "fallback_candidate");
  assert.equal(p.deliveryContext?.wordingMode, "not_sent_fallback_candidate");
});

test("T6.1.1 missing decisionId fails", () => {
  const bad = { ...validBase, decisionId: "" };
  assert.throws(() => parseOutreachDraftRequest(bad), /Too small/);
});

test("T6.1.1 missing deliveryContext fails", () => {
  const { deliveryContext: _d, ...rest } = validBase;
  assert.throws(() => parseOutreachDraftRequest(rest), /outreach_draft_requires_delivery_context/);
});

test("T6.1.1 missing deliveryContext optional but wording invalid enum fails when present", () => {
  const r = safeParseOutreachDraftRequest({
    ...validBase,
    deliveryContext: {
      deliveryVerdict: "target_available",
      wordingMode: "invalid",
    },
  });
  assert.equal(r.success, false);
});
