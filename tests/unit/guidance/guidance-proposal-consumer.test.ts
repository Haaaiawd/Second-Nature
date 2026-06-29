/**
 * GuidanceProposalConsumer — Unit Tests
 *
 * Validates: allow/downgrade consumption, source validation,
 * invalid source handling, degraded output, and GuidanceOutput shape.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  consumeGuidanceProposal,
} from "../../../src/core/second-nature/guidance/guidance-proposal-consumer.js";
import type { ActionProposal } from "../../../src/core/second-nature/action/action-proposal-builder.js";
import type { ActionPolicyDecision } from "../../../src/core/second-nature/action/autonomy-policy-evaluator.js";

function makeProposal(overrides?: Partial<ActionProposal>): ActionProposal {
  return {
    id: "proposal_001",
    cycleId: "cycle_001",
    judgmentVerdictId: "verdict_001",
    actionKind: "draft_reply",
    sourceRefs: [
      {
        uri: "sn://evidence/ev_001",
        family: "evidence",
        id: "ev_001",
        redactionClass: "none",
        sensitivityClass: "public_technical",
        resolveStatus: "resolvable",
      },
    ],
    reason: "proposal_created",
    riskPosture: "low",
    expectedOutput: "draft_reply",
    sideEffectClass: "local_state",
    idempotencyKey: "idem_001",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDecision(overrides?: Partial<ActionPolicyDecision>): ActionPolicyDecision {
  return {
    id: "decision_001",
    proposalId: "proposal_001",
    decision: "allow",
    decisionReason: "policy_allowed",
    autonomyLevel: "auto_allowed",
    proofRefs: [
      {
        uri: "sn://judgment/verdict_001",
        family: "judgment",
        id: "verdict_001",
        redactionClass: "none",
        resolveStatus: "resolvable",
      },
    ],
    decidedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("guidance-proposal-consumer", () => {
  describe("allow decisions", () => {
    it("consumes allowed draft_reply and returns GuidanceOutput", () => {
      const proposal = makeProposal({ actionKind: "draft_reply" });
      const decision = makeDecision({ decision: "allow" });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.output.mode, "draft");
        assert.strictEqual(result.output.deliveryClaim, "not_delivered");
        assert.strictEqual(result.output.actionKind, "draft_reply");
        assert.strictEqual(result.output.ownerVisible, true);
        assert.ok(result.output.sourceRefs.length > 0);
        assert.ok(result.output.decisionId);
      }
    });

    it("consumes allowed notify_owner and returns notify mode", () => {
      const proposal = makeProposal({ actionKind: "notify_owner" });
      const decision = makeDecision({ decision: "allow" });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.output.mode, "notify");
      }
    });
  });

  describe("downgrade decisions", () => {
    it("consumes downgraded auto_reply->draft_reply and returns draft mode", () => {
      const proposal = makeProposal({ actionKind: "auto_reply" });
      const decision = makeDecision({
        decision: "downgrade",
        downgradedActionKind: "draft_reply",
        decisionReason: "policy_downgraded_to_draft",
      });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.output.mode, "draft");
        assert.strictEqual(result.output.actionKind, "draft_reply");
      }
    });
  });

  describe("deny/defer decisions", () => {
    it("returns degraded for denied decisions", () => {
      const proposal = makeProposal();
      const decision = makeDecision({ decision: "deny", decisionReason: "policy_denied_high_risk" });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.degraded.status, "blocked");
        assert.strictEqual(result.degraded.reason, "policy_denied_high_risk");
        assert.strictEqual(result.degraded.ownerStage, "execution");
      }
    });

    it("degraded branch separates sourceRefs from proofRefs (T-GVS.R.4)", () => {
      const proposal = makeProposal();
      const decision = makeDecision({ decision: "deny", decisionReason: "policy_denied_high_risk" });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        // sourceRefs must be proposal.sourceRefs (real evidence), NOT decision.proofRefs
        assert.deepStrictEqual(
          result.degraded.sourceRefs,
          proposal.sourceRefs,
          "degraded.sourceRefs must equal proposal.sourceRefs, not decision.proofRefs",
        );
        // proofRefs must carry decision.proofRefs (policy proof)
        assert.deepStrictEqual(
          result.degraded.proofRefs,
          decision.proofRefs,
          "degraded.proofRefs must equal decision.proofRefs",
        );
        // ensure no cross-contamination: proofRefs ids must not appear in sourceRefs
        const sourceIds = new Set(result.degraded.sourceRefs.map((r) => r.id));
        for (const proof of result.degraded.proofRefs ?? []) {
          assert.ok(
            !sourceIds.has(proof.id),
            `proofRef ${proof.id} must not appear in sourceRefs`,
          );
        }
      }
    });

    it("returns degraded for deferred decisions", () => {
      const proposal = makeProposal();
      const decision = makeDecision({ decision: "defer", decisionReason: "policy_deferred_owner_confirmation" });
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.degraded.status, "blocked");
      }
    });
  });

  describe("source validation", () => {
    it("returns degraded when proposal has no source refs", () => {
      const proposal = makeProposal({ sourceRefs: [] });
      const decision = makeDecision();
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.degraded.reason, "source_refs_unresolved");
      }
    });

    it("returns degraded when source refs are missing", () => {
      const proposal = makeProposal({
        sourceRefs: [
          {
            uri: "sn://evidence/ev_001",
            family: "evidence",
            id: "ev_001",
            redactionClass: "none",
            resolveStatus: "missing",
          },
        ],
      });
      const decision = makeDecision();
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.degraded.reason, "source_refs_unresolved");
      }
    });
  });

  describe("GuidanceOutput shape", () => {
    it("includes all required fields", () => {
      const proposal = makeProposal();
      const decision = makeDecision();
      const result = consumeGuidanceProposal(proposal, decision);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.output.id);
        assert.ok(result.output.textRef.uri);
        assert.strictEqual(result.output.deliveryClaim, "not_delivered");
        assert.ok(Array.isArray(result.output.sourceRefs));
      }
    });
  });
});
