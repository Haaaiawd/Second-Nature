/**
 * PolicyBoundDispatch — Unit Tests
 *
 * Validates: deny/defer/downgrade/allow routing, guidance-unavailable fallback.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { dispatchAllowedAction } from "../../../src/core/second-nature/action/policy-bound-dispatch.js";
import type { ActionProposal } from "../../../src/core/second-nature/action/action-proposal-builder.js";
import type { ActionPolicyDecision } from "../../../src/core/second-nature/action/autonomy-policy-evaluator.js";

function makeProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: "prop_test",
    cycleId: "cyc_test",
    judgmentVerdictId: "jud_test",
    actionKind: overrides.actionKind ?? "run_connector",
    sourceRefs: overrides.sourceRefs ?? [{ uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }],
    reason: overrides.reason ?? "proposal_created",
    riskPosture: overrides.riskPosture ?? "low",
    expectedOutput: "test",
    sideEffectClass: overrides.sideEffectClass ?? "capability_declared",
    idempotencyKey: "idem_test",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ActionProposal;
}

function makeDecision(overrides: Partial<ActionPolicyDecision> = {}): ActionPolicyDecision {
  return {
    id: "dec_test",
    proposalId: "prop_test",
    decision: overrides.decision ?? "allow",
    decisionReason: overrides.decisionReason ?? "policy_allowed",
    autonomyLevel: overrides.autonomyLevel ?? "auto_allowed",
    proofRefs: [{ uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }],
    decidedAt: new Date().toISOString(),
    ...overrides,
  } as ActionPolicyDecision;
}

describe("policy-bound-dispatch", () => {
  describe("deny/defer", () => {
    it("returns none for deny", async () => {
      const result = dispatchAllowedAction(makeProposal(), makeDecision({ decision: "deny", decisionReason: "policy_denied_high_risk" }));
      assert.strictEqual(result.type, "none");
    });

    it("returns none for defer", async () => {
      const result = dispatchAllowedAction(makeProposal(), makeDecision({ decision: "defer", decisionReason: "policy_deferred_owner_confirmation" }));
      assert.strictEqual(result.type, "none");
    });
  });

  describe("allow", () => {
    it("returns connector dispatch for run_connector", async () => {
      const result = dispatchAllowedAction(makeProposal({ actionKind: "run_connector" }), makeDecision({ decision: "allow" }));
      assert.strictEqual(result.type, "connector");
    });

    it("returns guidance dispatch for auto_reply", async () => {
      const result = dispatchAllowedAction(makeProposal({ actionKind: "auto_reply", sideEffectClass: "external_write" }), makeDecision({ decision: "allow" }));
      assert.strictEqual(result.type, "guidance");
    });

    it("returns none for notify_owner", async () => {
      const result = dispatchAllowedAction(makeProposal({ actionKind: "notify_owner", sideEffectClass: "owner_attention" }), makeDecision({ decision: "allow" }));
      assert.strictEqual(result.type, "none");
    });
  });

  describe("downgrade", () => {
    it("returns guidance dispatch when guidance available", async () => {
      const result = dispatchAllowedAction(
        makeProposal({ actionKind: "auto_reply" }),
        makeDecision({ decision: "downgrade", downgradedActionKind: "draft_reply", decisionReason: "policy_downgraded_to_draft" }),
        { guidanceAvailable: true },
      );
      assert.strictEqual(result.type, "guidance");
    });

    it("returns guidance_unavailable when guidance unavailable", async () => {
      const result = dispatchAllowedAction(
        makeProposal({ actionKind: "auto_reply" }),
        makeDecision({ decision: "downgrade", downgradedActionKind: "draft_reply", decisionReason: "policy_downgraded_to_draft" }),
        { guidanceAvailable: false },
      );
      assert.strictEqual(result.type, "guidance_unavailable");
      if (result.type === "guidance_unavailable") {
        assert.strictEqual(result.downgradedActionKind, "draft_reply");
      }
    });
  });
});
