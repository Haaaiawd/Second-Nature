/**
 * v9 Loop Status Read — API Tests (T8.2.1)
 *
 * Validates: `aggregateLoopStatus` returns a JSON-serializable shape
 * suitable for `loop_status.read` API surface. Verifies:
 * - Overall health classification
 * - Stage attribution shape
 * - Continuity/routine/evolution/character sections
 * - No sensitive content in output
 * - Character summary passes safety validation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  aggregateLoopStatus,
  type LoopStatusInputs,
} from "../../../src/observability/v9-loop-health-aggregator.js";
import { validateCharacterSafety } from "../../../src/observability/v9-redaction-projector.js";

describe("API v9-loop-status.read", () => {
  function makeHealthyInputs(): LoopStatusInputs {
    return {
      stageEvents: [
        { stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" },
        { stageKind: "closure", status: "ok", reasonCode: "closure_completed" },
      ],
      cycleTraces: [{ closedAt: "2026-06-28T10:00:00Z" }],
      activityHealth: [],
      continuityCardResult: {
        kind: "ok",
        isStale: false,
        card: { sourceRefs: [{ family: "evidence", id: "m1" }] },
        projections: [{ kind: "memory" }, { kind: "procedural" }],
      },
      routineRegistrySnapshot: {
        routines: [
          {
            routineId: "r1",
            capabilityPattern: "moltbook:feed.read",
            version: "1.0.0",
            status: "active",
            rollbackRef: "ref-1",
            sourceRefs: [],
          },
        ],
      },
      connectorEvolutionResult: {
        planId: "p1",
        platformId: "moltbook",
        gates: [{ name: "schema", result: "pass" }],
        canaryResult: "pass",
        activeVersionRef: "v-2",
        previousStableRef: "v-1",
      },
      characterFrameEvents: [
        { frameId: "f1", eventKind: "accepted", sourceRefCount: 3 },
      ],
    };
  }

  it("returns JSON-serializable loop_status shape", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });

    // Must be JSON-serializable (no circular refs, no undefined)
    const json = JSON.stringify(result);
    assert.ok(json.length > 0);

    const parsed = JSON.parse(json);
    assert.ok(parsed.loop);
    assert.ok(parsed.continuity);
    assert.ok(parsed.routine);
    assert.ok(parsed.connectorEvolution);
    assert.ok(parsed.character);
    assert.ok(parsed.overall);
  });

  it("exposes overall = healthy for all-healthy inputs", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.equal(result.overall, "healthy");
    assert.equal(result.loop.overall, "healthy");
  });

  it("exposes stage attribution with all 13 stage kinds", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    const stageKinds = Object.keys(result.loop.stageAttribution);
    assert.ok(stageKinds.includes("evidence"));
    assert.ok(stageKinds.includes("perception"));
    assert.ok(stageKinds.includes("attention"));
    assert.ok(stageKinds.includes("activity"));
    assert.ok(stageKinds.includes("proposal"));
    assert.ok(stageKinds.includes("policy"));
    assert.ok(stageKinds.includes("dispatch"));
    assert.ok(stageKinds.includes("closure"));
    assert.ok(stageKinds.includes("quiet"));
    assert.ok(stageKinds.includes("dream"));
    assert.ok(stageKinds.includes("continuity"));
    assert.ok(stageKinds.includes("connector_evolution"));
    assert.ok(stageKinds.includes("rollback"));
  });

  it("exposes activity terminal counts", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.ok(result.loop.activityTerminalCounts);
    assert.equal(typeof result.loop.activityTerminalCounts.active, "number");
    assert.equal(typeof result.loop.activityTerminalCounts.completed, "number");
    assert.equal(typeof result.loop.activityTerminalCounts.blocked, "number");
  });

  it("exposes continuity health with projection counts", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.equal(result.continuity.cardAvailable, true);
    assert.equal(result.continuity.memoryProjectionCount, 1);
    assert.equal(result.continuity.proceduralProjectionCount, 1);
  });

  it("exposes routine health with installed count", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.equal(result.routine.installedCount, 1);
    assert.equal(result.routine.pendingValidationCount, 0);
    assert.ok(result.routine.rollbackReady);
  });

  it("exposes connector evolution health with gate summary", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.ok(result.connectorEvolution.gateSummary);
    assert.equal(result.connectorEvolution.gateSummary.schema, "pass");
    assert.equal(result.connectorEvolution.canaryResult, "pass");
    assert.equal(result.connectorEvolution.rollbackStatus, "not_needed");
  });

  it("exposes character frame health with safe summary", () => {
    const result = aggregateLoopStatus(makeHealthyInputs(), { currentCycleSequence: 1 });
    assert.equal(result.character.totalEvents, 1);
    assert.equal(result.character.acceptedCount, 1);
    assert.equal(result.character.hasDeferredOrConflict, false);

    // Summary must pass character safety validation
    const safety = validateCharacterSafety(result.character.summary);
    assert.ok(safety.safe, `Character summary should be safe: ${safety.violatedPatterns.join(", ")}`);
  });

  it("exposes overall = blocked when rollback stage is blocked", () => {
    const inputs = makeHealthyInputs();
    inputs.stageEvents = [
      { stageKind: "rollback", status: "blocked", reasonCode: "evolution_rollback_failed" },
    ];
    const result = aggregateLoopStatus(inputs, { currentCycleSequence: 1 });
    assert.equal(result.overall, "blocked");
    assert.equal(result.loop.overall, "blocked");
    assert.equal(result.loop.rollbackBlocked, true);
  });

  it("exposes overall = blocked when connector evolution gate fails", () => {
    const inputs = makeHealthyInputs();
    inputs.connectorEvolutionResult = {
      planId: "p1",
      platformId: "moltbook",
      gates: [{ name: "fixture", result: "fail" }],
    };
    const result = aggregateLoopStatus(inputs, { currentCycleSequence: 1 });
    assert.equal(result.overall, "blocked");
    assert.equal(result.connectorEvolution.blockedReason, "evolution_gate_fixture_failed");
  });

  it("exposes reasons array with unique entries", () => {
    const inputs = makeHealthyInputs();
    inputs.stageEvents = [
      { stageKind: "attention", status: "degraded", reasonCode: "attention_hint_without_agent_or_routine_intent" },
      { stageKind: "attention", status: "degraded", reasonCode: "attention_hint_without_agent_or_routine_intent" },
    ];
    const result = aggregateLoopStatus(inputs, { currentCycleSequence: 1 });
    const uniqueReasons = [...new Set(result.loop.reasons)];
    assert.deepEqual(result.loop.reasons, uniqueReasons);
  });
});
