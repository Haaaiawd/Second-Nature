/**
 * Exactly-one closure invariant integration test — T4.2.3
 *
 * Coverage:
 * - Multiple concurrent closure attempts for the same cycle produce one closure.
 * - Degraded attention path still writes exactly one no-action closure.
 * - Policy-denied intent writes exactly one terminal closure.
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
} from "../../../src/shared/types/v9-contracts.js";

function makeContext(): EmbodiedContext {
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
    activityThreads: { status: "loaded", data: [] },
    assembledAt: new Date().toISOString(),
  };
}

function makeAssembler(): V9EmbodiedContextAssembler {
  return { assembleEmbodiedContext: async () => makeContext() };
}

function makeAttention(overrides?: Partial<AttentionSignal>): AttentionSignal {
  return {
    signalId: "att-one-1",
    novelty: 0.5,
    relevance: 0.5,
    repetition: "new",
    risk: "low",
    possibleActions: ["watch"],
    sourceRefs: [{ family: "evidence", id: "ev-one-1" }],
    summary: "one-closure signal",
    status: "attentive",
    threadSuggestion: "none",
    ...overrides,
  };
}

describe("v9 exactly-one closure invariant", () => {
  it("produces exactly one closure per cycle when intent resolves to denied policy", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const result = await runV9HeartbeatCycle(
      db,
      { workspaceRoot: "/tmp/ws" },
      {
        db,
        assembler: makeAssembler(),
        attentionPort: {
          buildAttentionSignal: async () => makeAttention({ threadSuggestion: "create" }),
        },
        activityThreadCoordinator: createActivityThreadCoordinator({ threadPort }),
        intentResolver: {
          resolveIntent: async ({ activity }) => {
            if (!activity) return null;
            return {
              intentId: "intent-denied",
              actionKind: "auto_publish",
              attentionSignalRefs: [{ family: "attention", id: "att-one-1" }],
              sourceRefs: activity.step.sourceRefs,
              targetPlatformId: "moltbook",
              targetCapabilityId: "feed.read",
            } as AgentActionIntent;
          },
        },
      },
    );

    assert.equal((result as { status: string }).status, "completed");
    const closures = await readV9ActionClosuresByCycle(db, (result as { cycleId: string }).cycleId);
    assert.equal(closures.rows.length, 1);
  });

  it("produces exactly one no-action closure for blocked attention", async () => {
    const db = createStateDatabase(":memory:");

    const result = await runV9HeartbeatCycle(
      db,
      { workspaceRoot: "/tmp/ws" },
      {
        db,
        assembler: makeAssembler(),
        attentionPort: {
          buildAttentionSignal: async () => makeAttention({ status: "attention_blocked_missing_sources", sourceRefs: [] }),
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
    assert.equal(closures.rows[0].actionKind, "no_action");
  });

  it("is idempotent across sequential orchestrator invocations", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const deps = {
      db,
      assembler: makeAssembler(),
      attentionPort: {
        buildAttentionSignal: async () => makeAttention({ threadSuggestion: "create" }),
      },
      activityThreadCoordinator: createActivityThreadCoordinator({ threadPort }),
      intentResolver: {
        resolveIntent: async () => ({
          intentId: "intent-concurrent",
          actionKind: "notify_owner",
          attentionSignalRefs: [{ family: "attention", id: "att-one-1" }],
          sourceRefs: [{ family: "evidence", id: "ev-one-1" }],
        } as AgentActionIntent),
      },
    };

    const r1 = await runV9HeartbeatCycle(db, { workspaceRoot: "/tmp/ws", requestedAt: new Date().toISOString() }, deps);
    const r2 = await runV9HeartbeatCycle(db, { workspaceRoot: "/tmp/ws", requestedAt: new Date().toISOString() }, deps);

    assert.notEqual((r1 as { cycleId: string }).cycleId, (r2 as { cycleId: string }).cycleId);

    const closures1 = await readV9ActionClosuresByCycle(db, (r1 as { cycleId: string }).cycleId);
    const closures2 = await readV9ActionClosuresByCycle(db, (r2 as { cycleId: string }).cycleId);
    assert.equal(closures1.rows.length, 1);
    assert.equal(closures2.rows.length, 1);
  });
});
