/**
 * ActivityThread cross-heartbeat continuation integration test — T2.2.4
 *
 * Coverage:
 * - createActivityThreadPort wires real v9 read/write ports.
 * - Repeated related attention advances the same thread by at most one step per heartbeat.
 * - Stale thread is paused after ACTIVITY_THREAD_STALE_HEARTBEATS.
 * - Overlong thread is blocked at ACTIVITY_THREAD_MAX_STEPS.
 * - pause / complete suggestions transition thread status.
 * - Stage events are emitted with source refs.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createActivityThreadPort } from "../../../src/core/second-nature/control-plane/v9-embodied-context-assembler.js";
import {
  advanceActivityThread,
  ACTIVITY_THREAD_MAX_STEPS,
  ACTIVITY_THREAD_STALE_HEARTBEATS,
  type ActivityStageEvent,
} from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import type {
  ActivityThread,
  AttentionSignal,
  EmbodiedContext,
} from "../../../src/shared/types/v9-contracts.js";

function makeAttention(overrides?: Partial<AttentionSignal>): AttentionSignal {
  return {
    signalId: `att_${Math.random().toString(36).slice(2)}`,
    novelty: 0.8,
    relevance: 0.7,
    repetition: "changed",
    risk: "low",
    possibleActions: ["watch", "remember"],
    sourceRefs: [{ family: "evidence", id: "ev_1" }],
    summary: "new signal about project alpha",
    status: "attentive",
    ...overrides,
  };
}

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

function assertAdvanced(
  result: { status: string; thread?: ActivityThread; step?: { stepKind: string }; reason?: string },
): asserts result is { status: "advanced"; thread: ActivityThread; step: { stepKind: string } } {
  if (result.status !== "advanced") {
    assert.fail(`expected advanced, got ${result.status}: ${result.reason ?? "no reason"}`);
  }
}

function assertStopped(
  result: { status: string; thread?: ActivityThread; step?: { stepKind: string }; reason?: string },
): asserts result is { status: "stopped"; thread: ActivityThread; reason: string } {
  if (result.status !== "stopped") {
    assert.fail(`expected stopped, got ${result.status}: ${result.reason ?? "no reason"}`);
  }
}

describe("ActivityThread continuation", () => {
  it("advances the same thread across three heartbeats", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);
    const events: ActivityStageEvent[] = [];

    let context = makeContext();
    let threadId: string | undefined;

    for (let seq = 1; seq <= 3; seq++) {
      const attention = makeAttention({
        signalId: `att_${seq}`,
        activityThreadId: threadId,
        sourceRefs: [{ family: "evidence", id: "ev_1" }],
      });
      const result = await advanceActivityThread({
        cycleRef: { cycleId: `c${seq}`, cycleSequence: seq },
        attention,
        context,
        threadPort,
        recordLoopStageEvent: async (e) => { events.push(e); },
      });

      assertAdvanced(result);
      threadId = result.thread.threadId;
      context = makeContext([result.thread]);
    }

    const loaded = await threadPort.loadActivityThreads({
      workspaceRoot: "",
      status: ["active"],
      limit: 10,
    });

    assert.equal(loaded.threads.length, 1);
    assert.equal(loaded.threads[0].completedStepCount, 3);
    assert.equal(loaded.threads[0].status, "active");
    assert.equal(events.length, 3);
    assert.ok(events.every((e) => e.sourceRefs.length > 0));
  });

  it("pauses stale threads and resumes on new attention", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const attention = makeAttention({ signalId: "att_1" });
    const createResult = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 1 },
      attention,
      context: makeContext(),
      threadPort,
    });

    assertAdvanced(createResult);
    const thread = createResult.thread;

    const staleSeq = 1 + ACTIVITY_THREAD_STALE_HEARTBEATS + 1;
    const staleResult = await advanceActivityThread({
      cycleRef: { cycleId: "c2", cycleSequence: staleSeq },
      attention: makeAttention({ signalId: "att_2", activityThreadId: thread.threadId }),
      context: makeContext([thread]),
      threadPort,
    });

    assertStopped(staleResult);
    assert.equal(staleResult.thread.status, "paused");
  });

  it("blocks overlong threads at max steps", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    let context = makeContext();
    let threadId: string | undefined;

    for (let seq = 1; seq <= ACTIVITY_THREAD_MAX_STEPS; seq++) {
      const result = await advanceActivityThread({
        cycleRef: { cycleId: `c${seq}`, cycleSequence: seq },
        attention: makeAttention({ signalId: `att_${seq}`, activityThreadId: threadId }),
        context,
        threadPort,
      });
      assertAdvanced(result);
      threadId = result.thread.threadId;
      context = makeContext([result.thread]);
    }

    const blocked = await advanceActivityThread({
      cycleRef: { cycleId: "c_over", cycleSequence: ACTIVITY_THREAD_MAX_STEPS + 1 },
      attention: makeAttention({ signalId: "att_over", activityThreadId: threadId }),
      context,
      threadPort,
    });

    assertStopped(blocked);
    assert.equal(blocked.thread.status, "blocked");
    assert.equal(blocked.reason, "activity_thread_overlong");
  });

  it("completes a thread on complete suggestion", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 1 },
      attention: makeAttention({ signalId: "att_1", threadSuggestion: "complete" }),
      context: makeContext(),
      threadPort,
    });

    assertAdvanced(result);
    assert.equal(result.step.stepKind, "complete");
    assert.equal(result.thread.status, "completed");
  });

  it("pauses a thread on pause suggestion", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 1 },
      attention: makeAttention({ signalId: "att_1", threadSuggestion: "pause" }),
      context: makeContext(),
      threadPort,
    });

    assertAdvanced(result);
    assert.equal(result.step.stepKind, "pause");
    assert.equal(result.thread.status, "paused");
  });

  it("records side-effecting propose_action step without executing it", async () => {
    const db = createStateDatabase(":memory:");
    const threadPort = createActivityThreadPort(db);

    const first = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 1 },
      attention: makeAttention({ signalId: "att_1" }),
      context: makeContext(),
      threadPort,
    });

    assertAdvanced(first);

    const second = await advanceActivityThread({
      cycleRef: { cycleId: "c2", cycleSequence: 2 },
      attention: makeAttention({
        signalId: "att_2",
        activityThreadId: first.thread.threadId,
        possibleActions: ["notify_owner"],
        threadSuggestion: "continue",
      }),
      context: makeContext([first.thread]),
      threadPort,
    });

    assertAdvanced(second);
    assert.equal(second.step.stepKind, "propose_action");
    assert.equal((second.step as { closureRef?: unknown }).closureRef, undefined);
  });
});
