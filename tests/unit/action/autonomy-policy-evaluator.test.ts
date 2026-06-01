/**
 * AutonomyPolicyEvaluator — Unit Tests
 *
 * Validates: allow/defer/downgrade/deny decisions, side-effect class
 * branches, risk posture, breaker status, source-ref requirements.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { evaluateActionPolicy } from "../../../src/core/second-nature/action/autonomy-policy-evaluator.js";
import type { ActionProposal } from "../../../src/core/second-nature/action/action-proposal-builder.js";

function makeProposal(
  overrides: Partial<ActionProposal> = {},
): ActionProposal {
  return {
    id: "prop_test",
    cycleId: "cyc_test",
    judgmentVerdictId: "jud_test",
    actionKind: overrides.actionKind ?? "notify_owner",
    sourceRefs: overrides.sourceRefs ?? [
      { uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" },
    ],
    reason: overrides.reason ?? "proposal_created",
    riskPosture: overrides.riskPosture ?? "low",
    expectedOutput: "test",
    sideEffectClass: overrides.sideEffectClass ?? "owner_attention",
    idempotencyKey: "idem_test",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ActionProposal;
}

describe("autonomy-policy-evaluator", () => {
  describe("allow path", () => {
    it("allows low-risk owner-attention actions", () => {
      const proposal = makeProposal({ actionKind: "notify_owner", riskPosture: "low" });
      const decision = evaluateActionPolicy(proposal, { platformPermissionDeclared: true });
      assert.strictEqual(decision.decision, "allow");
      assert.strictEqual(decision.decisionReason, "policy_allowed");
      assert.strictEqual(decision.autonomyLevel, "auto_allowed");
    });

    it("allows low-risk run_connector with permission", () => {
      const proposal = makeProposal({ actionKind: "run_connector", riskPosture: "low", sideEffectClass: "capability_declared" });
      const decision = evaluateActionPolicy(proposal, { platformPermissionDeclared: true });
      assert.strictEqual(decision.decision, "allow");
    });
  });

  describe("deny path", () => {
    it("denies missing source refs for write actions", () => {
      const proposal = makeProposal({ actionKind: "auto_reply", sourceRefs: [], sideEffectClass: "external_write" });
      const decision = evaluateActionPolicy(proposal, {});
      assert.strictEqual(decision.decision, "deny");
      assert.strictEqual(decision.decisionReason, "policy_denied_missing_permission");
    });

    it("denies blocked risk", () => {
      const proposal = makeProposal({ riskPosture: "blocked" });
      const decision = evaluateActionPolicy(proposal, {});
      assert.strictEqual(decision.decision, "deny");
      assert.strictEqual(decision.decisionReason, "policy_denied_high_risk");
    });

    it("denies open breaker", () => {
      const proposal = makeProposal({ actionKind: "run_connector", riskPosture: "low" });
      const decision = evaluateActionPolicy(proposal, { breakerStatus: "open" });
      assert.strictEqual(decision.decision, "deny");
      assert.strictEqual(decision.decisionReason, "policy_denied_breaker_open");
    });
  });

  describe("defer path", () => {
    it("defers high risk", () => {
      const proposal = makeProposal({ riskPosture: "high" });
      const decision = evaluateActionPolicy(proposal, {});
      assert.strictEqual(decision.decision, "defer");
      assert.strictEqual(decision.decisionReason, "policy_deferred_owner_confirmation");
      assert.strictEqual(decision.autonomyLevel, "owner_confirm");
    });
  });

  describe("downgrade path", () => {
    it("downgrades auto_reply to draft_reply when no permission", () => {
      const proposal = makeProposal({ actionKind: "auto_reply", sideEffectClass: "external_write" });
      const decision = evaluateActionPolicy(proposal, { platformPermissionDeclared: false });
      assert.strictEqual(decision.decision, "downgrade");
      assert.strictEqual(decision.decisionReason, "policy_downgraded_to_draft");
      assert.strictEqual(decision.downgradedActionKind, "draft_reply");
    });

    it("downgrades auto_publish to draft_publish when owner blocks auto", () => {
      const proposal = makeProposal({ actionKind: "auto_publish", sideEffectClass: "external_write" });
      const decision = evaluateActionPolicy(proposal, { ownerPreferenceAllowAuto: false });
      assert.strictEqual(decision.decision, "downgrade");
      assert.strictEqual(decision.downgradedActionKind, "draft_publish");
    });
  });

  describe("source-ref leniency for non-write", () => {
    it("allows watch without source refs", () => {
      const proposal = makeProposal({ actionKind: "watch", sourceRefs: [], sideEffectClass: "local_state" });
      const decision = evaluateActionPolicy(proposal, {});
      assert.strictEqual(decision.decision, "allow");
    });
  });
});
