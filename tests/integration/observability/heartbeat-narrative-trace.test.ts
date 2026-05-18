import test from "node:test";
import assert from "node:assert/strict";

import {
  ingestRhythmSignal,
  type HeartbeatSignal,
  type HeartbeatDeps,
} from "../../../src/core/second-nature/heartbeat/index.js";
import type { NarrativeTracePayload } from "../../../src/observability/services/lived-experience-audit.js";

test("T5.1.2 narrative trace emitted after successful narrative state update", async () => {
  const recorded: NarrativeTracePayload[] = [];

  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-16T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: ["check-email"],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
      acceptedGoals: [
        {
          goalId: "goal-check-email",
          kind: "short_term",
          status: "accepted",
          origin: "owner_set",
          description: "check-email inbox processing",
          completionCriteria: "inbox zero",
          risk: "low",
          priorityHint: 1,
          sourceRefs: [],
          createdAt: "2026-05-16T00:00:00.000Z",
          updatedAt: "2026-05-16T00:00:00.000Z",
        },
      ],
    }),
    narrativeStateStore: {
      loadNarrativeState: async () => ({
        narrativeId: "narrative-001",
        revision: 3,
        focus: "prior focus",
        progress: ["p1"],
        nextIntent: "i1",
        confidence: 0.5,
        sourceRefs: [{ sourceId: "s1", kind: "workspace_artifact", url: "https://a.b" }],
        unsupportedClaims: [],
        status: "active" as const,
        updatedAt: "2026-05-16T09:00:00Z",
      }),
      updateNarrativeState: async () => ({
        narrativeId: "narrative-001",
        status: "acknowledged" as const,
      }),
    },
    recordNarrativeTrace: async (payload) => {
      recorded.push(payload);
    },
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.status, "intent_selected");
  assert.equal(recorded.length, 1);

  const trace = recorded[0];
  assert.ok(trace.traceId.startsWith("narrative_trace:"));
  assert.equal(trace.narrativeId, "narrative-001");
  assert.equal(typeof trace.revision, "number");
  assert.equal(trace.updateSource, "heartbeat");
  assert.ok(Array.isArray(trace.sourceRefs));
  assert.ok(Array.isArray(trace.unsupportedClaims));
  assert.ok(["pass", "degraded", "blocked"].includes(trace.groundingStatus));
  // T5.1.2: goalInfluenceRefs must propagate the actual accepted goal ids that
  // influenced the selected intent (not just sourceRefs ids).
  assert.deepEqual(trace.goalInfluenceRefs, ["goal-check-email"]);
  assert.ok(typeof trace.createdAt === "string");
});

test("T5.1.2 no trace emitted when narrativeStateStore absent", async () => {
  const recorded: NarrativeTracePayload[] = [];

  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-16T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: ["check-email"],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
    }),
    recordNarrativeTrace: async (payload) => {
      recorded.push(payload);
    },
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.status, "intent_selected");
  assert.equal(recorded.length, 0);
});

test("T5.1.2 no trace emitted when recordNarrativeTrace absent even with store", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-16T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: ["check-email"],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
    }),
    narrativeStateStore: {
      loadNarrativeState: async () => ({
        narrativeId: "narrative-002",
        revision: 1,
        focus: "f",
        progress: [],
        nextIntent: "i",
        confidence: 0.5,
        sourceRefs: [],
        unsupportedClaims: [],
        status: "active" as const,
        updatedAt: "2026-05-16T09:00:00Z",
      }),
      updateNarrativeState: async () => ({
        narrativeId: "narrative-002",
        status: "acknowledged" as const,
      }),
    },
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.status, "intent_selected");
  // should not throw; store updated but no trace emitted
});

test("T5.1.2 trace emitter throwing must not block cycle result", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-16T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: ["check-email"],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
    }),
    narrativeStateStore: {
      loadNarrativeState: async () => ({
        narrativeId: "narrative-003",
        revision: 2,
        focus: "f",
        progress: [],
        nextIntent: "i",
        confidence: 0.5,
        sourceRefs: [],
        unsupportedClaims: [],
        status: "active" as const,
        updatedAt: "2026-05-16T09:00:00Z",
      }),
      updateNarrativeState: async () => ({
        narrativeId: "narrative-003",
        status: "acknowledged" as const,
      }),
    },
    recordNarrativeTrace: async () => {
      throw new Error("trace_sink_unavailable");
    },
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.status, "intent_selected");
  // cycle must complete even when trace emission fails
});

test("T5.1.2 groundedStatus=degraded when prior unsupportedClaims preserved", async () => {
  const recorded: NarrativeTracePayload[] = [];
  const decisionTraces: unknown[] = [];

  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-16T10:00:00Z" },
  };

  // All candidates blocked → no intent selected; prior state preserved including unsupportedClaims
  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: true,
    }),
    narrativeStateStore: {
      loadNarrativeState: async () => ({
        narrativeId: "narrative-004",
        revision: 1,
        focus: "f",
        progress: [],
        nextIntent: "i",
        confidence: 0.5,
        sourceRefs: [],
        unsupportedClaims: ["claim A", "claim B"],
        status: "active" as const,
        updatedAt: "2026-05-16T09:00:00Z",
      }),
      updateNarrativeState: async () => ({
        narrativeId: "narrative-004",
        status: "acknowledged" as const,
      }),
    },
    recordDecisionTrace: async (payload) => {
      decisionTraces.push(payload);
    },
    recordNarrativeTrace: async (payload) => {
      recorded.push(payload);
    },
  };

  const result = await ingestRhythmSignal(signal, deps);

  // Debug: understand the actual flow
  assert.equal(result.status, "denied");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].groundingStatus, "degraded");
  assert.deepEqual(recorded[0].unsupportedClaims, ["claim A", "claim B"]);
});
