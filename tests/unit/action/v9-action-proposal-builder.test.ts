/**
 * v9 ActionProposalBuilder — Unit Tests
 *
 * Validates:
 * - Agent-authored intent → proposal
 * - ActivityStepIntent → proposal (only authored steps)
 * - RoutineInvocation → routine proposal
 * - AttentionSignal refs used only as grounding
 * - Attention-only / ignore / watch / remember → no_action
 * - Missing source refs → no_action
 * - connector_read suggestion → no_action
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildV9ActionProposal,
  buildV9ActionProposals,
  MAX_PROPOSALS_PER_CYCLE,
  type ActivityStepIntent,
} from "../../../src/core/second-nature/action/v9-action-proposal-builder.js";
import type {
  AgentActionIntent,
  AttentionSignalRef,
  RoutineInvocation,
  SourceRef,
  ToolRoutineReadModel,
} from "../../../src/shared/types/v9-contracts.js";

function makeAgentIntent(
  overrides: Partial<AgentActionIntent> = {},
): AgentActionIntent {
  return {
    intentId: "intent-1",
    actionKind: "notify_owner",
    attentionSignalRefs: [{ family: "attention", id: "sig-1" }],
    sourceRefs: [{ family: "evidence", id: "ev-1" }],
    ...overrides,
  };
}

function makeAttentionRef(
  overrides: Partial<AttentionSignalRef> = {},
): AttentionSignalRef {
  return {
    signalId: "sig-1",
    selectedActionKind: "notify_owner",
    rationale: "owner should know",
    sourceRefs: [{ family: "attention", id: "sig-1" }],
    ...overrides,
  };
}

function makeRoutineInvocation(
  overrides: Partial<RoutineInvocation> = {},
): RoutineInvocation {
  return {
    routineId: "routine-1",
    version: "1.0.0",
    capabilityPattern: "moltbook:feed.read",
    triggerCapabilities: ["moltbook:feed.read"],
    payload: { limit: 10 },
    sourceRefs: [{ family: "routine", id: "routine-1" }],
    ...overrides,
  };
}

function makeRoutineReadModel(
  overrides: Partial<ToolRoutineReadModel> = {},
): ToolRoutineReadModel {
  return {
    routineId: "routine-1",
    capabilityPattern: "moltbook:feed.read",
    triggerCapabilities: ["moltbook:feed.read"],
    version: "1.0.0",
    status: "active",
    sourceRefs: [{ family: "routine", id: "routine-1" }],
    ...overrides,
  };
}

function makeActivityStepIntent(
  overrides: Partial<ActivityStepIntent> = {},
): ActivityStepIntent {
  return {
    stepId: "step-1",
    threadId: "thread-1",
    cycleId: "cyc-1",
    stepKind: "propose_action",
    summary: "propose reply",
    sourceRefs: [{ family: "activity", id: "step-1" }],
    authoredBy: "agent",
    proposedActionKind: "draft_reply",
    targetPlatformId: "moltbook",
    targetCapabilityId: "feed.read",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("v9-action-proposal-builder", () => {
  describe("agent intent", () => {
    it("builds proposal from agent notify_owner intent", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({ actionKind: "notify_owner" }),
        attentionRefs: [makeAttentionRef()],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.actionKind, "notify_owner");
      assert.equal(result.proposal.sideEffectClass, "owner_attention");
      assert.equal(result.proposal.sourceRefs.length, 2);
      assert.ok(result.proposal.idempotencyKey.startsWith("idem_cyc-1_intent-1"));
    });

    it("builds external_write proposal with attention grounding", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({
          actionKind: "auto_reply",
          targetPlatformId: "moltbook",
          targetCapabilityId: "feed.read",
        }),
        attentionRefs: [
          makeAttentionRef({
            platformId: "moltbook",
            capabilityId: "feed.read",
          }),
        ],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.actionKind, "auto_reply");
      assert.equal(result.proposal.sideEffectClass, "external_write");
      assert.equal(result.proposal.targetPlatformId, "moltbook");
      assert.equal(result.proposal.targetCapabilityId, "feed.read");
      assert.equal(result.proposal.riskPosture, "medium");
    });

    it("blocks agent external_write without source refs", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({
          actionKind: "auto_publish",
          sourceRefs: [],
        }),
        attentionRefs: [],
      });
      assert.equal(result.status, "no_action");
      if (result.status !== "no_action") return;
      assert.equal(result.reason, "policy_denied_missing_sources");
    });

    it("builds routine proposal from routineInvocation", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({
          actionKind: "run_connector",
          routineInvocation: makeRoutineInvocation(),
        }),
        routineReadModel: makeRoutineReadModel(),
        attentionRefs: [],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.actionKind, "routine");
      assert.equal(result.proposal.sideEffectClass, "routine");
      assert.equal(result.proposal.routineInvocationId, "routine-1");
      assert.equal(result.proposal.routineVersion, "1.0.0");
      assert.equal(result.proposal.targetCapabilityId, "moltbook:feed.read");
    });
  });

  describe("activity step intent", () => {
    it("builds proposal from authored propose_action step", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        activityStepIntent: makeActivityStepIntent(),
        attentionRefs: [makeAttentionRef()],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.actionKind, "draft_reply");
      assert.equal(result.proposal.sideEffectClass, "local_state");
    });

    it("ignores non-executable activity steps", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        activityStepIntent: makeActivityStepIntent({
          stepKind: "observe",
          proposedActionKind: undefined,
        }),
        attentionRefs: [makeAttentionRef()],
      });
      assert.equal(result.status, "no_action");
      if (result.status !== "no_action") return;
      assert.equal(
        result.reason,
        "attention_hint_without_agent_or_routine_intent",
      );
    });

    it("uses attention kind when activity step lacks proposedActionKind", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        activityStepIntent: makeActivityStepIntent({
          proposedActionKind: undefined,
        }),
        attentionRefs: [
          makeAttentionRef({ selectedActionKind: "notify_owner" }),
        ],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.actionKind, "notify_owner");
    });
  });

  describe("attention boundary", () => {
    it("attention-only refs do not author proposal", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        attentionRefs: [makeAttentionRef({ selectedActionKind: "notify_owner" })],
      });
      assert.equal(result.status, "no_action");
      if (result.status !== "no_action") return;
      assert.equal(
        result.reason,
        "attention_hint_without_agent_or_routine_intent",
      );
    });

    it("watch attention suggestion returns no_action", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        attentionRefs: [
          makeAttentionRef({
            selectedActionKind: "watch",
            platformId: "moltbook",
            capabilityId: "feed.read",
          }),
        ],
      });
      assert.equal(result.status, "no_action");
    });

    it("deduplicates attention source refs", () => {
      const sharedRef: SourceRef = { family: "evidence", id: "ev-1" };
      const distinctRef: SourceRef = { family: "attention", id: "sig-1" };
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({ sourceRefs: [sharedRef] }),
        attentionRefs: [
          makeAttentionRef({ sourceRefs: [sharedRef, distinctRef] }),
          makeAttentionRef({ sourceRefs: [sharedRef] }),
        ],
      });
      assert.equal(result.status, "proposal");
      if (result.status !== "proposal") return;
      assert.equal(result.proposal.sourceRefs.length, 2);
    });
  });

  describe("non-actionable kinds", () => {
    it("ignore returns no_action", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({ actionKind: "ignore" }),
        attentionRefs: [],
      });
      assert.equal(result.status, "no_action");
      assert.equal(result.reason, "proposal_no_action");
    });

    it("watch returns no_action", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({ actionKind: "watch" }),
        attentionRefs: [],
      });
      assert.equal(result.status, "no_action");
    });

    it("remember returns no_action", () => {
      const result = buildV9ActionProposal({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({ actionKind: "remember" }),
        attentionRefs: [],
      });
      assert.equal(result.status, "no_action");
    });
  });

  describe("batch builder", () => {
    it("partitions proposals and no_actions", () => {
      const result = buildV9ActionProposals([
        {
          cycleId: "cyc-1",
          agentIntent: makeAgentIntent({ actionKind: "notify_owner" }),
          attentionRefs: [makeAttentionRef()],
        },
        {
          cycleId: "cyc-1",
          attentionRefs: [makeAttentionRef()],
        },
      ]);
      assert.equal(result.proposals.length, 1);
      assert.equal(result.noActions.length, 1);
    });

    it("enforces MAX_PROPOSALS_PER_CYCLE", () => {
      const inputs = Array.from({ length: MAX_PROPOSALS_PER_CYCLE + 2 }, (_, i) => ({
        cycleId: "cyc-1",
        agentIntent: makeAgentIntent({
          intentId: `intent-${i}`,
          actionKind: "notify_owner" as const,
        }),
        attentionRefs: [makeAttentionRef({ signalId: `sig-${i}` })],
      }));
      const result = buildV9ActionProposals(inputs);
      assert.equal(result.proposals.length, MAX_PROPOSALS_PER_CYCLE);
      assert.equal(result.noActions.length, 2);
    });
  });
});
