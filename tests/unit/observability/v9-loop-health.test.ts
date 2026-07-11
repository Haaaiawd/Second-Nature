/**
 * v9 Loop Health Aggregator — Unit Tests (T8.2.1)
 *
 * Validates:
 * - aggregateLoopHealth: stage event classification, missing closure, activity health
 * - aggregateActivityThreadHealth: stale/overlong/missing-closure/blocked
 * - aggregateContinuityHealth: available/unavailable/stale
 * - aggregateRoutineHealth: installed/pending/denied/rollbackReady
 * - aggregateConnectorEvolutionHealth: gate fail/canary fail/rollback fail
 * - aggregateCharacterFrameHealth: deferred/conflict counts, safe summary
 * - aggregateLoopStatus: composite overall health
 * - Bilingual character-safety: no emotion/personality/identity-lock in output
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  aggregateLoopHealth,
  aggregateActivityThreadHealth,
  aggregateContinuityHealth,
  aggregateRoutineHealth,
  aggregateConnectorEvolutionHealth,
  aggregateCharacterFrameHealth,
  aggregateLoopStatus,
  PERF,
  type ActivityThreadSnapshot,
  type StageEventInput,
  type CycleTraceInput,
  type ActivityThreadHealthOutput,
  type SelfContinuityCardAssemblyResultInput,
  type ToolRoutineRegistrySnapshotInput,
  type ConnectorEvolutionResultInput,
  type CharacterFrameEventInput,
} from "../../../src/observability/v9-loop-health-aggregator.js";
import { validateCharacterSafety } from "../../../src/observability/v9-redaction-projector.js";

// ───────────────────────────────────────────────────────────────
// aggregateLoopHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateLoopHealth", () => {
  it("returns healthy for empty window", () => {
    const result = aggregateLoopHealth(
      { stageEvents: [], cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "healthy");
    assert.equal(result.reasons.length, 0);
    assert.equal(result.rollbackBlocked, false);
  });

  it("classifies blocked stage event", () => {
    const events: StageEventInput[] = [
      { stageKind: "rollback", status: "blocked", reasonCode: "evolution_rollback_failed" },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: events, cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "blocked");
    assert.equal(result.rollbackBlocked, true);
    assert.ok(result.reasons.includes("evolution_rollback_failed"));
  });

  it("classifies degraded stage event", () => {
    const events: StageEventInput[] = [
      { stageKind: "attention", status: "degraded", reasonCode: "attention_hint_without_agent_or_routine_intent" },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: events, cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "degraded");
    assert.ok(result.reasons.includes("attention_hint_without_agent_or_routine_intent"));
  });

  it("classifies ok stage event as ok attribution", () => {
    const events: StageEventInput[] = [
      { stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: events, cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "healthy");
    assert.equal(result.stageAttribution.evidence, "ok");
  });

  it("blocked takes priority over degraded for same stage", () => {
    const events: StageEventInput[] = [
      { stageKind: "activity", status: "degraded", reasonCode: "activity_thread_stale" },
      { stageKind: "activity", status: "blocked", reasonCode: "activity_thread_blocked" },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: events, cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.stageAttribution.activity, "blocked");
    assert.equal(result.overall, "blocked");
  });

  it("detects missing closure traces", () => {
    const traces: CycleTraceInput[] = [
      { closedAt: null },
      { closedAt: "2026-06-28T10:00:00Z" },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: [], cycleTraces: traces, activityHealth: [] },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "blocked");
    assert.ok(result.reasons.includes("loop_degraded_missing_closure"));
  });

  it("aggregates activity thread health", () => {
    const activityHealth: ActivityThreadHealthOutput[] = [
      {
        threadId: "thread-1",
        threadStatus: "blocked",
        status: "blocked",
        reasonCode: "activity_thread_blocked",
        completedStepCount: 3,
        lastHeartbeatSequence: 1,
        closureLinked: false,
        sourceRefs: [],
      },
    ];
    const result = aggregateLoopHealth(
      { stageEvents: [], cycleTraces: [], activityHealth },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "blocked");
    assert.ok(result.reasons.includes("activity_thread_blocked"));
    assert.equal(result.activityTerminalCounts.blocked, 1);
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateActivityThreadHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateActivityThreadHealth", () => {
  const baseSnapshot: ActivityThreadSnapshot = {
    threadId: "thread-1",
    threadStatus: "active",
    completedStepCount: 2,
    lastHeartbeatSequence: 5,
    lastStepKind: "observe",
    closureLinked: true,
    sourceRefs: [],
  };

  it("returns healthy for active thread within thresholds", () => {
    const result = aggregateActivityThreadHealth(baseSnapshot, 10);
    assert.equal(result.status, "healthy");
    assert.equal(result.reasonCode, null);
  });

  it("returns degraded for stale active thread", () => {
    const snapshot = { ...baseSnapshot, lastHeartbeatSequence: 1 };
    const result = aggregateActivityThreadHealth(snapshot, 10);
    assert.equal(result.status, "degraded");
    assert.equal(result.reasonCode, "activity_thread_stale");
  });

  it("returns blocked for overlong thread", () => {
    const snapshot = { ...baseSnapshot, completedStepCount: PERF.ACTIVITY_THREAD_MAX_STEPS + 1 };
    const result = aggregateActivityThreadHealth(snapshot, 10);
    assert.equal(result.status, "blocked");
    assert.equal(result.reasonCode, "activity_thread_overlong");
  });

  it("returns blocked for missing closure after propose_action", () => {
    const snapshot = { ...baseSnapshot, lastStepKind: "propose_action", closureLinked: false };
    const result = aggregateActivityThreadHealth(snapshot, 10);
    assert.equal(result.status, "blocked");
    assert.equal(result.reasonCode, "activity_thread_missing_closure");
  });

  it("returns blocked for blocked thread status", () => {
    const snapshot = { ...baseSnapshot, threadStatus: "blocked" as const };
    const result = aggregateActivityThreadHealth(snapshot, 10);
    assert.equal(result.status, "blocked");
    assert.equal(result.reasonCode, "activity_thread_blocked");
  });

  it("does not flag stale for paused thread", () => {
    const snapshot = { ...baseSnapshot, threadStatus: "paused" as const, lastHeartbeatSequence: 1 };
    const result = aggregateActivityThreadHealth(snapshot, 10);
    assert.equal(result.status, "healthy");
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateContinuityHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateContinuityHealth", () => {
  it("returns unavailable for unavailable card", () => {
    const result = aggregateContinuityHealth({
      kind: "unavailable",
      reasonCode: "continuity_unavailable",
    });
    assert.equal(result.cardAvailable, false);
    assert.equal(result.projectionFreshness, "missing");
    assert.equal(result.unavailableReason, "continuity_unavailable");
    assert.equal(result.memoryProjectionCount, 0);
  });

  it("returns fresh for available card with projections", () => {
    const result = aggregateContinuityHealth({
      kind: "ok",
      isStale: false,
      card: { sourceRefs: [{ family: "evidence", id: "mem-1" }] },
      projections: [
        { kind: "memory" },
        { kind: "memory" },
        { kind: "procedural" },
      ],
    });
    assert.equal(result.cardAvailable, true);
    assert.equal(result.projectionFreshness, "fresh");
    assert.equal(result.cardSourceRefCount, 1);
    assert.equal(result.memoryProjectionCount, 2);
    assert.equal(result.proceduralProjectionCount, 1);
  });

  it("returns stale for stale card", () => {
    const result = aggregateContinuityHealth({
      kind: "ok",
      isStale: true,
      card: { sourceRefs: [] },
      projections: [],
    });
    assert.equal(result.projectionFreshness, "stale");
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateRoutineHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateRoutineHealth", () => {
  it("returns healthy for empty registry", () => {
    const result = aggregateRoutineHealth({ routines: [] });
    assert.equal(result.installedCount, 0);
    assert.equal(result.pendingValidationCount, 0);
    assert.equal(result.deniedCount, 0);
    assert.ok(result.rollbackReady);
    assert.equal(result.reasons.length, 0);
  });

  it("counts installed/pending/denied routines", () => {
    const snapshot: ToolRoutineRegistrySnapshotInput = {
      routines: [
        { routineId: "r1", capabilityPattern: "moltbook:feed.read", version: "1.0.0", status: "active", rollbackRef: "ref-1", sourceRefs: [] },
        { routineId: "r2", capabilityPattern: "moltbook:feed.write", version: "1.0.0", status: "validated", sourceRefs: [] },
        { routineId: "r3", capabilityPattern: "instreet:post.read", version: "1.0.0", status: "candidate", healthReason: "routine_permission_expansion_denied", sourceRefs: [] },
      ],
    };
    const result = aggregateRoutineHealth(snapshot);
    assert.equal(result.installedCount, 1);
    assert.equal(result.pendingValidationCount, 1);
    assert.equal(result.deniedCount, 1);
    assert.ok(result.rollbackReady);
    assert.ok(result.reasons.includes("routine_validation_pending"));
    assert.ok(result.reasons.includes("routine_permission_expansion_denied"));
  });

  it("rollbackReady=false when active routine lacks rollbackRef", () => {
    const snapshot: ToolRoutineRegistrySnapshotInput = {
      routines: [
        { routineId: "r1", capabilityPattern: "moltbook:feed.read", version: "1.0.0", status: "active", sourceRefs: [] },
      ],
    };
    const result = aggregateRoutineHealth(snapshot);
    assert.ok(!result.rollbackReady);
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateConnectorEvolutionHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateConnectorEvolutionHealth", () => {
  it("returns healthy for all-pass gates", () => {
    const result = aggregateConnectorEvolutionHealth({
      planId: "plan-1",
      platformId: "moltbook",
      gates: [
        { name: "schema", result: "pass" },
        { name: "permission", result: "pass" },
      ],
      canaryResult: "pass",
      activeVersionRef: "v-2",
      previousStableRef: "v-1",
    });
    assert.equal(result.canaryResult, "pass");
    assert.equal(result.rollbackStatus, "not_needed");
    assert.equal(result.blockedReason, undefined);
  });

  it("returns blockedReason for gate failure", () => {
    const result = aggregateConnectorEvolutionHealth({
      planId: "plan-1",
      platformId: "moltbook",
      gates: [{ name: "fixture", result: "fail" }],
    });
    assert.equal(result.blockedReason, "evolution_gate_fixture_failed");
  });

  it("returns blockedReason for canary failure", () => {
    const result = aggregateConnectorEvolutionHealth({
      planId: "plan-1",
      platformId: "moltbook",
      gates: [{ name: "schema", result: "pass" }],
      canaryResult: "fail",
    });
    assert.equal(result.blockedReason, "evolution_canary_failed");
  });

  it("returns blockedReason for rollback failure", () => {
    const result = aggregateConnectorEvolutionHealth({
      planId: "plan-1",
      platformId: "moltbook",
      gates: [{ name: "schema", result: "pass" }],
      rollbackAttempted: true,
      rollbackSucceeded: false,
    });
    assert.equal(result.rollbackStatus, "failed");
    assert.equal(result.blockedReason, "evolution_rollback_failed");
  });

  it("returns success for rollback success", () => {
    const result = aggregateConnectorEvolutionHealth({
      planId: "plan-1",
      platformId: "moltbook",
      gates: [{ name: "schema", result: "pass" }],
      rollbackAttempted: true,
      rollbackSucceeded: true,
    });
    assert.equal(result.rollbackStatus, "success");
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateCharacterFrameHealth
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateCharacterFrameHealth", () => {
  it("returns zero counts for empty events", () => {
    const result = aggregateCharacterFrameHealth([]);
    assert.equal(result.totalEvents, 0);
    assert.equal(result.hasDeferredOrConflict, false);
  });

  it("counts events by kind", () => {
    const events: CharacterFrameEventInput[] = [
      { frameId: "f1", eventKind: "accepted", sourceRefCount: 3 },
      { frameId: "f2", eventKind: "rejected", sourceRefCount: 1 },
      { frameId: "f3", eventKind: "deferred", sourceRefCount: 0 },
    ];
    const result = aggregateCharacterFrameHealth(events);
    assert.equal(result.totalEvents, 3);
    assert.equal(result.acceptedCount, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.deferredCount, 1);
    assert.ok(result.hasDeferredOrConflict);
  });

  it("summary text passes character safety validation", () => {
    const events: CharacterFrameEventInput[] = [
      { frameId: "f1", eventKind: "accepted", sourceRefCount: 3 },
      { frameId: "f2", eventKind: "deferred", sourceRefCount: 0 },
    ];
    const result = aggregateCharacterFrameHealth(events);
    const safety = validateCharacterSafety(result.summary);
    assert.ok(safety.safe, `Summary should be safe: ${safety.violatedPatterns.join(", ")}`);
  });
});

// ───────────────────────────────────────────────────────────────
// aggregateLoopStatus (composite)
// ───────────────────────────────────────────────────────────────

describe("T8.2.1 aggregateLoopStatus", () => {
  it("returns healthy for all-healthy inputs", () => {
    const result = aggregateLoopStatus(
      {
        stageEvents: [{ stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" }],
        cycleTraces: [{ closedAt: "2026-06-28T10:00:00Z" }],
        activityHealth: [],
        continuityCardResult: {
          kind: "ok",
          isStale: false,
          card: { sourceRefs: [{ family: "evidence", id: "m1" }] },
          projections: [{ kind: "memory" }],
        },
        routineRegistrySnapshot: { routines: [] },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "pass" }],
          canaryResult: "pass",
        },
        characterFrameEvents: [],
      },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "healthy");
    assert.equal(result.loop.overall, "healthy");
    assert.equal(result.continuity.cardAvailable, true);
    assert.equal(result.routine.installedCount, 0);
    assert.equal(result.connectorEvolution.blockedReason, undefined);
  });

  it("returns blocked when connector evolution has gate failure", () => {
    const result = aggregateLoopStatus(
      {
        stageEvents: [],
        cycleTraces: [],
        activityHealth: [],
        continuityCardResult: { kind: "ok", isStale: false, card: { sourceRefs: [] }, projections: [] },
        routineRegistrySnapshot: { routines: [] },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "fail" }],
        },
        characterFrameEvents: [],
      },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "blocked");
  });

  it("returns degraded when continuity unavailable", () => {
    const result = aggregateLoopStatus(
      {
        stageEvents: [],
        cycleTraces: [],
        activityHealth: [],
        continuityCardResult: { kind: "unavailable", reasonCode: "continuity_unavailable" },
        routineRegistrySnapshot: { routines: [] },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "pass" }],
        },
        characterFrameEvents: [],
      },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "degraded");
  });

  it("returns degraded when character has deferred events", () => {
    const result = aggregateLoopStatus(
      {
        stageEvents: [],
        cycleTraces: [],
        activityHealth: [],
        continuityCardResult: { kind: "ok", isStale: false, card: { sourceRefs: [] }, projections: [] },
        routineRegistrySnapshot: { routines: [] },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "pass" }],
        },
        characterFrameEvents: [{ frameId: "f1", eventKind: "deferred", sourceRefCount: 0 }],
      },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "degraded");
  });

  it("returns degraded when routine has pending validation", () => {
    const result = aggregateLoopStatus(
      {
        stageEvents: [],
        cycleTraces: [],
        activityHealth: [],
        continuityCardResult: { kind: "ok", isStale: false, card: { sourceRefs: [] }, projections: [] },
        routineRegistrySnapshot: {
          routines: [
            { routineId: "r1", capabilityPattern: "x:y", version: "1.0.0", status: "validated", sourceRefs: [] },
          ],
        },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "pass" }],
        },
        characterFrameEvents: [],
      },
      { currentCycleSequence: 1 },
    );
    assert.equal(result.overall, "degraded");
  });
});
