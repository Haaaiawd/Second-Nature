/**
 * v9 HeartbeatOrchestrator — Unit Tests
 *
 * Validates:
 * - Runtime unavailable returns carrier_only
 * - Context assembly failure still produces no-action closure
 * - Attention degraded / missing sources produces no-action closure
 * - No Agent/routine intent produces no-action closure
 * - Agent intent flows through policy to closure
 * - Activity thread linkage is passed to closure recorder
 * - Routine invocation linkage is passed to closure recorder
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  runV9HeartbeatCycle,
  type V9HeartbeatOrchestratorDeps,
  type V9HeartbeatOrchestrationRequest,
  type AttentionPort,
  type AgentActionIntentResolver,
  type ActionClosurePort,
} from "../../../src/core/second-nature/control-plane/v9-heartbeat-orchestrator.js";
import { createActivityThreadCoordinator } from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import type {
  ActivityStep,
  ActivityThread,
  AttentionSignal,
  EmbodiedContext,
  AgentActionIntent,
  SourceRef,
  V9ReasonCode,
  ActionClosureActionKind,
  ActionPolicyDecision,
  ActionProposal,
  DegradedOperationResult,
} from "../../../src/shared/types/v9-contracts.js";
import { readV9ActionClosuresByCycle } from "../../../src/core/second-nature/action/v9-action-closure-recorder.js";

function makeContext(threads?: ActivityThread[]): EmbodiedContext {
  return {
    identity: { status: "loaded", data: {} as never },
    goals: { status: "loaded", data: [] },
    recentInteractions: { status: "loaded", data: [] },
    toolExperience: { status: "loaded", data: [] },
    acceptedDream: { status: "loaded", data: [] },
    affordanceMap: { status: "loaded", data: {} as never },
    selfHealth: { status: "loaded", data: {} as never },
    selfContinuityCard: { status: "loaded", data: {} as never },
    characterFramePointer: { status: "loaded", data: {} as never },
    characterFrameProjection: { status: "loaded", data: {} as never },
    activeMemoryProjections: { status: "loaded", data: [] },
    activeProceduralProjections: { status: "loaded", data: [] },
    routineList: { status: "loaded", data: [] },
    activityThreads: { status: "loaded", data: threads ?? [] },
    assembledAt: new Date().toISOString(),
  };
}

function makeAttention(overrides?: Partial<AttentionSignal>): AttentionSignal {
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
    threadSuggestion: "create",
    ...overrides,
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

describe("v9-heartbeat-orchestrator", () => {
  it("returns carrier_only when runtime is unavailable", async () => {
    const deps = makeDeps();
    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "", runtimeAvailable: false }, deps);

    assert.equal("status" in result && result.status, "carrier_only");
    assert.equal((result as { noActionReason?: V9ReasonCode }).noActionReason, "runtime_unavailable");
  });

  it("produces no-action closure when attention is blocked missing sources", async () => {
    const deps = makeDeps({
      attentionPort: {
        buildAttentionSignal: async () =>
          makeAttention({
            status: "attention_blocked_missing_sources",
            sourceRefs: [],
          }),
      },
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "degraded");
    assert.equal((result as { noActionReason?: V9ReasonCode }).noActionReason, "attention_blocked_missing_sources");

    const closures = await readV9ActionClosuresByCycle(deps.db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].actionKind, "no_action");
  });

  it("produces no-action closure when no Agent/routine intent", async () => {
    const deps = makeDeps();
    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");
    assert.equal(
      (result as { noActionReason?: V9ReasonCode }).noActionReason,
      "attention_hint_without_agent_or_routine_intent",
    );

    const closures = await readV9ActionClosuresByCycle(deps.db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
  });

  it("records policy outcome closure for agent intent", async () => {
    const intent: AgentActionIntent = {
      intentId: "intent-1",
      actionKind: "auto_reply",
      attentionSignalRefs: [{ family: "attention", id: "att-1" }],
      sourceRefs: [{ family: "evidence", id: "ev-1" }],
      targetPlatformId: "moltbook",
      targetCapabilityId: "feed.read",
    };

    const deps = makeDeps({
      intentResolver: {
        resolveIntent: async () => intent,
      },
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");
    assert.ok((result as { closureRef?: SourceRef }).closureRef);

    const closures = await readV9ActionClosuresByCycle(deps.db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].platformId, "moltbook");
    assert.equal(closures.rows[0].capabilityId, "feed.read");
  });

  it("passes routine invocation linkage to closure", async () => {
    const intent: AgentActionIntent = {
      intentId: "intent-2",
      actionKind: "routine",
      attentionSignalRefs: [{ family: "attention", id: "att-1" }],
      sourceRefs: [{ family: "routine", id: "routine-1" }],
      routineInvocation: {
        routineId: "routine-1",
        version: "1.0.0",
        capabilityPattern: "moltbook:feed.read",
        triggerCapabilities: ["moltbook:feed.read"],
        payload: {},
        sourceRefs: [{ family: "routine", id: "routine-1" }],
      },
    };

    const deps = makeDeps({
      intentResolver: {
        resolveIntent: async () => intent,
      },
      actionClosurePort: {
        evaluateAndDispatch: async () => ({
          actionKind: "routine" as ActionClosureActionKind,
          decision: "deny" as ActionPolicyDecision["decision"],
          reasonCode: "routine_guard_policy_denied",
          proposal: undefined,
        }),
      },
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "completed");

    const closures = await readV9ActionClosuresByCycle(deps.db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].routineInvocationId, "routine-1");
    assert.equal(closures.rows[0].routineVersion, "1.0.0");
  });

  it("handles degraded context assembly with fallback closure", async () => {
    const deps = makeDeps({
      assembler: {
        assembleEmbodiedContext: async () => {
          throw new Error("assembly boom");
        },
      },
    });

    const result = await runV9HeartbeatCycle(deps.db, { workspaceRoot: "" }, deps);

    assert.equal((result as { status: string }).status, "degraded");
    const closures = await readV9ActionClosuresByCycle(deps.db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].reasonCode, "continuity_unavailable");
  });
});
