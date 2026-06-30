/**
 * v9 Routine Guard Policy Closure — Integration Tests (T4.2.2)
 *
 * Validates end-to-end: routine intent with guard schema flows through
 * heartbeat orchestrator → proposal builder → policy evaluator → closure,
 * producing the correct decision/reason.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  runV9HeartbeatCycle,
  type V9HeartbeatOrchestratorDeps,
  type ActionClosurePort,
} from "../../../src/core/second-nature/control-plane/v9-heartbeat-orchestrator.js";
import { createActivityThreadCoordinator } from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import { evaluateV9ActionPolicy } from "../../../src/core/second-nature/action/v9-autonomy-policy-evaluator.js";
import { readV9ActionClosuresByCycle } from "../../../src/core/second-nature/action/v9-action-closure-recorder.js";
import type {
  ActivityThread,
  AgentActionIntent,
  AttentionSignal,
  EmbodiedContext,
  ActionClosureActionKind,
  ActionPolicyDecision,
  AffordancePosture,
} from "../../../src/shared/types/v9-contracts.js";

function makeContext(): EmbodiedContext {
  const posture: AffordancePosture = {
    platformId: "moltbook",
    capabilityId: "feed.read",
    accessLevel: "credentialed",
    reliabilityLevel: "proven",
    familiarityLevel: "practiced",
    sourceRefs: [{ family: "capability_probe_result", id: "probe-1" }],
  };

  return {
    identity: { status: "loaded", data: {} as never },
    goals: { status: "loaded", data: [] },
    recentInteractions: { status: "loaded", data: [] },
    toolExperience: { status: "loaded", data: [] },
    acceptedDream: { status: "loaded", data: [] },
    affordanceMap: { status: "loaded", data: { entries: [posture] } as never },
    selfHealth: { status: "loaded", data: {} as never },
    selfContinuityCard: { status: "loaded", data: {} as never },
    characterFramePointer: { status: "loaded", data: {} as never },
    characterFrameProjection: { status: "loaded", data: {} as never },
    activeMemoryProjections: { status: "loaded", data: [] },
    activeProceduralProjections: { status: "loaded", data: [] },
    routineList: { status: "loaded", data: [] },
    activityThreads: { status: "loaded", data: [] },
    assembledAt: new Date().toISOString(),
  };
}

function makeAttention(): AttentionSignal {
  return {
    signalId: "att-1",
    novelty: 0.8,
    relevance: 0.7,
    repetition: "changed",
    risk: "low",
    possibleActions: ["watch", "remember"],
    sourceRefs: [{ family: "evidence", id: "ev-1" }],
    summary: "new signal",
    status: "attentive",
    threadSuggestion: "none",
  };
}

function makeDeps(
  overrides: Partial<V9HeartbeatOrchestratorDeps> = {},
): V9HeartbeatOrchestratorDeps {
  return {
    db: createStateDatabase(":memory:"),
    assembler: {
      assembleEmbodiedContext: async () => makeContext(),
    },
    attentionPort: {
      buildAttentionSignal: async () => makeAttention(),
    },
    activityThreadCoordinator: createActivityThreadCoordinator({
      threadPort: {
        loadActivityThreads: async () => ({ status: "loaded", data: [] }),
        createActivityThread: async (input) => ({ status: "loaded", data: input }),
        appendActivityStep: async (input) => ({ status: "loaded", data: input }),
        updateActivityThreadStatus: async (threadId, status) => ({
          status: "loaded",
          data: { threadId, status } as ActivityThread,
        }),
        updateActivityThreadProgress: async (threadId, patch) => ({
          status: "loaded",
          data: { threadId, ...patch } as ActivityThread,
        }),
      },
    }),
    intentResolver: {
      resolveIntent: async () => null,
    },
    ...overrides,
  };
}

function makeActionClosurePort(context: EmbodiedContext): ActionClosurePort {
  return {
    async evaluateAndDispatch(intent, cycleRef) {
      const { buildV9ActionProposal } = await import(
        "../../../src/core/second-nature/action/v9-action-proposal-builder.js"
      );
      const proposalResult = buildV9ActionProposal({
        cycleId: cycleRef.cycleId,
        agentIntent: intent,
        attentionRefs: intent.attentionSignalRefs.map((ref) => ({
          signalId: ref.id,
          selectedActionKind: "watch",
          rationale: "attention grounding",
          sourceRefs: [ref],
        })),
        now: new Date().toISOString(),
      });

      if (proposalResult.status === "no_action") {
        return {
          actionKind: "no_action",
          decision: "deny",
          reasonCode: proposalResult.reason,
        };
      }

      const proposal = proposalResult.proposal;
      const decision = evaluateV9ActionPolicy(proposal, {
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
        routineStatus: "active",
      });

      return {
        actionKind: proposal.actionKind as ActionClosureActionKind,
        decision: decision.decision,
        reasonCode: decision.decisionReason,
        proposal,
        downgradedActionKind: decision.downgradedActionKind,
      };
    },
  };
}

function makeRoutineIntent(guardSchemaJson: string): AgentActionIntent {
  return {
    intentId: "intent-routine",
    actionKind: "routine",
    attentionSignalRefs: [{ family: "attention", id: "att-1" }],
    sourceRefs: [{ family: "routine", id: "routine-1" }],
    targetPlatformId: "moltbook",
    targetCapabilityId: "moltbook:feed.read",
    routineInvocation: {
      routineId: "routine-1",
      version: "1.0.0",
      capabilityPattern: "moltbook:feed.read",
      triggerCapabilities: ["moltbook:feed.read"],
      payload: {},
      sourceRefs: [{ family: "routine", id: "routine-1" }],
      guardSchemaJson,
    },
  };
}

describe("v9 routine-policy-closure integration", () => {
  it("records allowed closure for routine with valid guard", async () => {
    const context = makeContext();
    const deps = makeDeps({
      assembler: { assembleEmbodiedContext: async () => context },
      intentResolver: {
        resolveIntent: async () =>
          makeRoutineIntent(
            JSON.stringify({
              version: "1.0.0",
              allowedCapabilities: ["moltbook:feed.read"],
              deniedCapabilities: [],
              maxSideEffectClass: "owner_attention",
              requiresOwnerConfirm: false,
              maxStepCount: 5,
              maxTimeoutMs: 1000,
              sandboxPolicy: "declarative_only",
            }),
          ),
      },
      actionClosurePort: makeActionClosurePort(context),
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");
    const closures = await readV9ActionClosuresByCycle(
      deps.db,
      (result as { cycleId: string }).cycleId,
    );
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].reasonCode, "policy_allowed");
    assert.equal(closures.rows[0].actionKind, "routine");
  });

  it("records permission-expansion-denied closure for routine guard that expands capability", async () => {
    const context = makeContext();
    const deps = makeDeps({
      assembler: { assembleEmbodiedContext: async () => context },
      intentResolver: {
        resolveIntent: async () =>
          makeRoutineIntent(
            JSON.stringify({
              version: "1.0.0",
              allowedCapabilities: ["moltbook:feed.read", "moltbook:feed.write"],
              deniedCapabilities: [],
              maxSideEffectClass: "owner_attention",
              requiresOwnerConfirm: false,
              maxStepCount: 5,
              maxTimeoutMs: 1000,
              sandboxPolicy: "declarative_only",
            }),
          ),
      },
      actionClosurePort: makeActionClosurePort(context),
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");
    const closures = await readV9ActionClosuresByCycle(
      deps.db,
      (result as { cycleId: string }).cycleId,
    );
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].reasonCode, "routine_permission_expansion_denied");
    assert.equal(closures.rows[0].actionKind, "routine");
  });

  it("records owner-confirm downgrade closure when guard requires owner confirm", async () => {
    const context = makeContext();
    const deps = makeDeps({
      assembler: { assembleEmbodiedContext: async () => context },
      intentResolver: {
        resolveIntent: async () =>
          makeRoutineIntent(
            JSON.stringify({
              version: "1.0.0",
              allowedCapabilities: ["moltbook:feed.read"],
              deniedCapabilities: [],
              maxSideEffectClass: "owner_attention",
              requiresOwnerConfirm: true,
              maxStepCount: 5,
              maxTimeoutMs: 1000,
              sandboxPolicy: "declarative_only",
            }),
          ),
      },
      actionClosurePort: makeActionClosurePort(context),
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");
    const closures = await readV9ActionClosuresByCycle(
      deps.db,
      (result as { cycleId: string }).cycleId,
    );
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].reasonCode, "policy_downgraded_to_draft");
  });
});
