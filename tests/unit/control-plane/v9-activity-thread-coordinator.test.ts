/**
 * ActivityThreadCoordinator tests — T2.2.4
 *
 * Coverage:
 * - attentive attention creates a new ActivityThread and appends one step
 * - attentive attention continues an existing thread by activityThreadId
 * - attentive attention continues an existing thread by source overlap
 * - degraded / blocked attention skips without mutation
 * - missing source refs blocks advance
 * - max-step guard blocks overlong threads
 * - stale heartbeat guard pauses stale threads
 * - pause / complete suggestions transition thread lifecycle
 * - propose_action step is recorded but not executed by coordinator
 * - stage events are emitted on advance / skip / stop
 * - port degraded paths propagate degraded result
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  advanceActivityThread,
  ACTIVITY_THREAD_MAX_STEPS,
  ACTIVITY_THREAD_STALE_HEARTBEATS,
  type ActivityStageEvent,
  type ActivityThreadPort,
} from "../../../src/core/second-nature/control-plane/activity-thread-coordinator.js";
import type {
  ActivityThread,
  ActivityStep,
  AttentionSignal,
  EmbodiedContext,
} from "../../../src/shared/types/v9-contracts.js";

function makeAttention(overrides?: Partial<AttentionSignal>): AttentionSignal {
  return {
    signalId: "att_1",
    activityThreadId: undefined,
    threadSuggestion: undefined,
    novelty: 0.8,
    relevance: 0.7,
    repetition: "new",
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
    activityThreads: {
      status: "loaded",
      data: threads ?? [],
    },
    assembledAt: new Date().toISOString(),
  };
}

function makeThread(overrides?: Partial<ActivityThread>): ActivityThread {
  return {
    threadId: "thread_1",
    originAttentionSignalId: "att_1",
    status: "active",
    currentFocus: "project alpha",
    associations: ["possible: watch"],
    nextPossibleMoves: ["observe"],
    completedStepCount: 0,
    stopCondition: "single_step_done",
    lastHeartbeatSequence: 1,
    sourceRefs: [{ family: "evidence", id: "ev_1" }],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockPort(overrides?: Partial<ActivityThreadPort>, initialThreads?: ActivityThread[]): ActivityThreadPort {
  const threads = new Map<string, ActivityThread>(initialThreads?.map((t) => [t.threadId, t]));
  const steps = new Map<string, ActivityStep>();
  return {
    async loadActivityThreads() {
      return { threads: [] };
    },
    async createActivityThread(input) {
      threads.set(input.threadId, input);
      return { thread: input };
    },
    async appendActivityStep(input) {
      steps.set(input.stepId, input);
      return { step: input };
    },
    async updateActivityThreadStatus(threadId, status, reason) {
      const t = threads.get(threadId);
      if (!t) return { thread: {} as ActivityThread, degraded: { reason: "missing", code: "x" } };
      const updated = { ...t, status, blockerReason: reason, updatedAt: new Date().toISOString() };
      threads.set(threadId, updated);
      return { thread: updated };
    },
    async updateActivityThreadProgress(threadId, patch) {
      const t = threads.get(threadId);
      if (!t) return { thread: {} as ActivityThread, degraded: { reason: "missing", code: "x" } };
      const updated = { ...t, ...patch, updatedAt: new Date().toISOString() };
      threads.set(threadId, updated);
      return { thread: updated };
    },
    ...overrides,
  };
}

function assertAdvanced(
  result: { status: string; thread?: ActivityThread; step?: ActivityStep; reason?: string },
): asserts result is { status: "advanced"; thread: ActivityThread; step: ActivityStep } {
  if (result.status !== "advanced") {
    assert.fail(`expected advanced, got ${result.status}: ${result.reason ?? "no reason"}`);
  }
}

function assertStopped(
  result: { status: string; thread?: ActivityThread; step?: ActivityStep; reason?: string },
): asserts result is { status: "stopped"; thread: ActivityThread; reason: string } {
  if (result.status !== "stopped") {
    assert.fail(`expected stopped, got ${result.status}: ${result.reason ?? "no reason"}`);
  }
}

function assertSkipped(
  result: { status: string; reason?: string },
  expectedReason: string,
): void {
  if (result.status !== "skipped") {
    assert.fail(`expected skipped, got ${result.status}`);
  }
  assert.equal(result.reason, expectedReason);
}

function assertDegraded(
  result: { status: string; reason?: string },
  expectedReason: string,
): void {
  if (result.status !== "degraded") {
    assert.fail(`expected degraded, got ${result.status}`);
  }
  assert.equal(result.reason, expectedReason);
}

describe("advanceActivityThread", () => {
  it("creates a new thread and advances one associate step", async () => {
    const events: ActivityStageEvent[] = [];
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention(),
      context: makeContext(),
      threadPort: mockPort(),
      recordLoopStageEvent: async (e) => { events.push(e); },
    });

    assertAdvanced(result);
    assert.equal(result.thread.status, "active");
    assert.equal(result.thread.completedStepCount, 1);
    assert.equal(result.step.stepKind, "associate");
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "completed");
  });

  it("continues the thread referenced by activityThreadId", async () => {
    const existing = makeThread({ threadId: "thread_2", completedStepCount: 1, lastStepKind: "observe" });
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 3 },
      attention: makeAttention({ activityThreadId: "thread_2", threadSuggestion: "continue" }),
      context: makeContext([existing]),
      threadPort: mockPort(undefined, [existing]),
    });

    assertAdvanced(result);
    assert.equal(result.thread.threadId, "thread_2");
    assert.equal(result.thread.completedStepCount, 2);
    assert.equal(result.step.stepKind, "associate");
  });

  it("continues a thread with overlapping source refs", async () => {
    const existing = makeThread({ threadId: "thread_3" });
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 3 },
      attention: makeAttention({ sourceRefs: [{ family: "evidence", id: "ev_1" }] }),
      context: makeContext([existing]),
      threadPort: mockPort(undefined, [existing]),
    });

    assertAdvanced(result);
    assert.equal(result.thread.threadId, "thread_3");
  });

  it("skips when attention is not attentive", async () => {
    const events: ActivityStageEvent[] = [];
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention({ status: "attention_blocked_missing_sources", reason: "missing sources" }),
      context: makeContext(),
      threadPort: mockPort(),
      recordLoopStageEvent: async (e) => { events.push(e); },
    });

    assertSkipped(result, "attention_not_attentive");
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "skipped");
  });

  it("skips when attention has no source refs", async () => {
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention({ sourceRefs: [] }),
      context: makeContext(),
      threadPort: mockPort(),
    });

    assertSkipped(result, "attention_blocked_missing_sources");
  });

  it("blocks overlong threads at max steps", async () => {
    const existing = makeThread({
      threadId: "thread_max",
      completedStepCount: ACTIVITY_THREAD_MAX_STEPS,
    });
    const events: ActivityStageEvent[] = [];
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: existing.lastHeartbeatSequence + 1 },
      attention: makeAttention({ activityThreadId: "thread_max" }),
      context: makeContext([existing]),
      threadPort: mockPort(undefined, [existing]),
      recordLoopStageEvent: async (e) => { events.push(e); },
    });

    assertStopped(result);
    assert.equal(result.thread.status, "blocked");
    assert.equal(result.reason, "activity_thread_overlong");
    assert.equal(events[0].reason, "activity_thread_overlong");
  });

  it("pauses stale threads after too many heartbeats", async () => {
    const existing = makeThread({
      threadId: "thread_stale",
      completedStepCount: 2,
      lastHeartbeatSequence: 1,
    });
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 1 + ACTIVITY_THREAD_STALE_HEARTBEATS + 1 },
      attention: makeAttention({ activityThreadId: "thread_stale" }),
      context: makeContext([existing]),
      threadPort: mockPort(undefined, [existing]),
    });

    assertStopped(result);
    assert.equal(result.thread.status, "paused");
    assert.equal(result.reason, "activity_thread_stale");
  });

  it("pauses thread when suggestion is pause", async () => {
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention({ threadSuggestion: "pause" }),
      context: makeContext(),
      threadPort: mockPort(),
    });

    assertAdvanced(result);
    assert.equal(result.step.stepKind, "pause");
    assert.equal(result.thread.status, "paused");
  });

  it("completes thread when suggestion is complete", async () => {
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention({ threadSuggestion: "complete" }),
      context: makeContext(),
      threadPort: mockPort(),
    });

    assertAdvanced(result);
    assert.equal(result.step.stepKind, "complete");
    assert.equal(result.thread.status, "completed");
  });

  it("records propose_action step but does not execute side effects", async () => {
    const existing = makeThread({ threadId: "thread_propose", completedStepCount: 2, lastStepKind: "ask_agent" });
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 3 },
      attention: makeAttention({ possibleActions: ["notify_owner"], threadSuggestion: "continue" }),
      context: makeContext([existing]),
      threadPort: mockPort(undefined, [existing]),
    });

    assertAdvanced(result);
    assert.equal(result.step.stepKind, "propose_action");
    assert.equal(result.step.closureRef, undefined);
  });

  it("propagates degraded from createActivityThread", async () => {
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention(),
      context: makeContext(),
      threadPort: mockPort({
        async createActivityThread() {
          return { thread: {} as ActivityThread, degraded: { reason: "db unavailable", code: "state_unreadable" } };
        },
      }),
    });

    assertDegraded(result, "db unavailable");
  });

  it("advances at most one step per heartbeat", async () => {
    const result = await advanceActivityThread({
      cycleRef: { cycleId: "c1", cycleSequence: 2 },
      attention: makeAttention(),
      context: makeContext(),
      threadPort: mockPort(),
    });

    assertAdvanced(result);
    assert.ok(result.step);
    assert.equal(result.thread.completedStepCount, 1);
  });
});
