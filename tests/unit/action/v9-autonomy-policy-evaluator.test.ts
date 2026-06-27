/**
 * v9 AutonomyPolicyEvaluator — Unit Tests
 *
 * Validates:
 * - allow path for low-risk none/local_state actions
 * - deny path for missing source refs, blocked risk, open breaker
 * - defer path for high risk
 * - downgrade path for external_write without permission or owner pref
 * - owner_attention downgrade
 * - routine allow/deny based on active status and policy context
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateV9ActionPolicy,
  type EvaluateV9ActionPolicyContext,
} from "../../../src/core/second-nature/action/v9-autonomy-policy-evaluator.js";
import type { ActionProposal } from "../../../src/shared/types/v9-contracts.js";

function makeProposal(
  overrides: Partial<ActionProposal> = {},
): ActionProposal {
  return {
    id: "prop_test",
    cycleId: "cyc_test",
    actionKind: overrides.actionKind ?? "notify_owner",
    sourceRefs: overrides.sourceRefs ?? [
      { family: "evidence", id: "ev1" },
    ],
    proofRefs: [],
    reason: "proposal_created",
    riskPosture: overrides.riskPosture ?? "low",
    sideEffectClass: overrides.sideEffectClass ?? "owner_attention",
    idempotencyKey: "idem_test",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<EvaluateV9ActionPolicyContext> = {},
): EvaluateV9ActionPolicyContext {
  return {
    affordancePosture: {
      platformId: "moltbook",
      capabilityId: "feed.read",
      accessLevel: "credentialed",
      reliabilityLevel: "proven",
      familiarityLevel: "practiced",
      sourceRefs: [{ family: "capability_probe_result", id: "probe-1" }],
    },
    platformPermissionDeclared: true,
    circuitBreakerClosed: true,
    ownerPreference: true,
    credentialHealth: "ok",
    ...overrides,
  };
}

describe("v9-autonomy-policy-evaluator", () => {
  describe("allow path", () => {
    it("downgrades low-risk owner-attention actions", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({ actionKind: "notify_owner" }),
        makeContext(),
      );
      assert.equal(decision.decision, "downgrade");
      assert.equal(decision.decisionReason, "policy_downgraded_to_draft");
      assert.equal(decision.autonomyLevel, "draft_only");
      assert.equal(decision.downgradedActionKind, "watch");
    });

    it("allows run_connector with permission and low risk", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "run_connector",
          sideEffectClass: "capability_declared",
          riskPosture: "low",
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "allow");
    });

    it("denies watch without source refs", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "watch",
          sideEffectClass: "local_state",
          sourceRefs: [],
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });
  });

  describe("deny path", () => {
    it("denies missing source refs for external_write", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "auto_reply",
          sideEffectClass: "external_write",
          sourceRefs: [],
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });

    it("denies blocked risk", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({ riskPosture: "blocked" }),
        makeContext(),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_high_risk");
    });

    it("denies open breaker", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "run_connector",
          sideEffectClass: "capability_declared",
          riskPosture: "low",
        }),
        makeContext({ circuitBreakerClosed: false }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_breaker_open");
    });

    it("denies high-risk external_write", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "auto_reply",
          sideEffectClass: "external_write",
          riskPosture: "high",
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_high_risk");
    });

    it("denies external_write without platform permission", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "auto_reply",
          sideEffectClass: "external_write",
        }),
        makeContext({ platformPermissionDeclared: false }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });

    it("denies external_write when owner blocks auto", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "auto_publish",
          sideEffectClass: "external_write",
        }),
        makeContext({ ownerPreference: false }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });

    it("denies capability_declared without permission", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "run_connector",
          sideEffectClass: "capability_declared",
          riskPosture: "low",
        }),
        makeContext({ platformPermissionDeclared: false }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });

    it("denies local_state without source refs", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "draft_reply",
          sideEffectClass: "local_state",
          sourceRefs: [],
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "policy_denied_missing_permission");
    });
  });

  describe("downgrade path", () => {
    it("downgrades medium-risk external_write to owner_confirm", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "auto_publish",
          sideEffectClass: "external_write",
          riskPosture: "medium",
        }),
        makeContext(),
      );
      assert.equal(decision.decision, "downgrade");
      assert.equal(decision.decisionReason, "policy_downgraded_to_draft");
      assert.equal(decision.downgradedActionKind, "draft_publish");
      assert.equal(decision.autonomyLevel, "owner_confirm");
    });

    it("downgrades notify_owner to watch", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({ actionKind: "notify_owner" }),
        makeContext(),
      );
      assert.equal(decision.decision, "downgrade");
      assert.equal(decision.downgradedActionKind, "watch");
      assert.equal(decision.autonomyLevel, "draft_only");
    });
  });

  describe("routine policy", () => {
    it("allows active routine with healthy context", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "routine",
          sideEffectClass: "routine",
          routineInvocationId: "routine-1",
          routineVersion: "1.0.0",
        }),
        makeContext({ routineStatus: "active" }),
      );
      assert.equal(decision.decision, "allow");
      assert.equal(decision.autonomyLevel, "auto_allowed");
    });

    it("denies routine that is not active", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "routine",
          sideEffectClass: "routine",
        }),
        makeContext({ routineStatus: "candidate" }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "routine_invocation_denied");
    });

    it("denies routine when policy context is unhealthy", () => {
      const decision = evaluateV9ActionPolicy(
        makeProposal({
          actionKind: "routine",
          sideEffectClass: "routine",
        }),
        makeContext({
          routineStatus: "active",
          ownerPreference: false,
        }),
      );
      assert.equal(decision.decision, "deny");
      assert.equal(decision.decisionReason, "routine_guard_policy_denied");
    });
  });
});
