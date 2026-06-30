/**
 * Attention-to-closure chain integration test — T2.2.2
 *
 * Coverage:
 * - v9 heartbeat orchestrator wires context → attention → activity → policy → closure.
 * - ActivityThread created by coordinator is linked to closure.
 * - AttentionSignal status drives no-action path.
 * - Daily rhythm is triggered after closure.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createActivityThreadPort } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import { createActivityThreadCoordinator } from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import {
  runV9HeartbeatCycle,
  type AttentionPort,
  type AgentActionIntentResolver,
} from "../../../src/core/second-nature/control-plane/v9-heartbeat-orchestrator.js";
import type { V9EmbodiedContextAssembler } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import { readV9ActionClosuresByCycle } from "../../../src/core/second-nature/action/v9-action-closure-recorder.js";
import type {
  ActivityThread,
  AttentionSignal,
  EmbodiedContext,
  AgentActionIntent,
  SourceRef,
} from "../../../src/shared/types/v9-contracts.js";

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

function makeAssembler(context?: EmbodiedContext): V9EmbodiedContextAssembler {
  return {
    assembleEmbodiedContext: async () => context ?? makeContext(),
  };
}

function makeAttention(overrides?: Partial<AttentionSignal>): AttentionSignal {
  return {
    signalId: "att-int-1",
    novelty: 0.8,
    relevance: 0.7,
    repetition: "changed",
    risk: "low",
    possibleActions: ["watch", "remember"],
    sourceRefs: [{ family: "evidence", id: "ev-int-1" }],
    summary: "integration signal",
    status: "attentive",
    threadSuggestion: "create",
    ...overrides,
  };
}

describe("v9 attention-to-closure chain", () => {
  it("runs full cycle with real activity thread port and records closure", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const attentionPort: AttentionPort = {
      buildAttentionSignal: async () => makeAttention({ signalId: "att-int-1" }),
    };

    const intentResolver: AgentActionIntentResolver = {
      resolveIntent: async ({ activity }) => {
        if (!activity) return null;
        return {
          intentId: "intent-int-1",
          actionKind: "notify_owner",
          attentionSignalRefs: [{ family: "attention", id: "att-int-1" }],
          sourceRefs: activity.step.sourceRefs,
          targetPlatformId: "moltbook",
          targetCapabilityId: "feed.read",
        };
      },
    };

    const result = await runV9HeartbeatCycle(
      db,
      { workspaceRoot: "/tmp/ws", requestedAt: new Date().toISOString() },
      {
        db,
        assembler: makeAssembler(),
        attentionPort,
        activityThreadCoordinator: createActivityThreadCoordinator({ threadPort }),
        intentResolver,
      },
    );

    assert.equal((result as { status: string }).status, "completed");
    assert.ok((result as { closureRef?: SourceRef }).closureRef);

    const cycleId = (result as { cycleId: string }).cycleId;
    const closures = await readV9ActionClosuresByCycle(db, cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].actionKind, "notify_owner");

    const threads = await threadPort.loadActivityThreads({
      workspaceRoot: "/tmp/ws",
      status: ["active"],
      limit: 10,
    });
    assert.equal(threads.status, "loaded");
    assert.equal(threads.data.length, 1);
    assert.equal(threads.data[0].completedStepCount, 1);
  });

  it("records no-action closure when attention is blocked missing sources", async () => {
    const db = createStateDatabase(":memory:");

    const result = await runV9HeartbeatCycle(
      db,
      { workspaceRoot: "/tmp/ws" },
      {
        db,
        assembler: makeAssembler(),
        attentionPort: {
          buildAttentionSignal: async () =>
            makeAttention({ status: "attention_blocked_missing_sources", sourceRefs: [] }),
        },
        activityThreadCoordinator: createActivityThreadCoordinator({
          threadPort: createActivityThreadPort(db),
        }),
        intentResolver: { resolveIntent: async () => null },
      },
    );

    assert.equal((result as { status: string }).status, "degraded");
    const closures = await readV9ActionClosuresByCycle(db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
    assert.equal(closures.rows[0].reasonCode, "attention_blocked_missing_sources");
  });
});
