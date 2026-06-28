/**
 * v9 Rollback Liveness Gate — Integration Test (T8.2.2)
 *
 * Verifies end-to-end flow:
 * 1. Plan in gating status past threshold → watchdog infers rollback_failed
 * 2. Inferred event is emitted to stage event store
 * 3. aggregateLoopHealth sees the inferred event → overall = blocked
 * 4. Explicit rollback success → healthy
 * 5. Explicit rollback failure → blocked (not inferred)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  rollbackHealthGate,
  ROLLBACK_WATCHDOG,
  type RollbackHealthGateDeps,
  type StageEventForWatchdog,
  type InferredRollbackEvent,
} from "../../../src/observability/v9-rollback-health-gate.js";
import {
  aggregateLoopHealth,
  type StageEventInput,
} from "../../../src/observability/v9-loop-health-aggregator.js";
import type { ConnectorEvolutionPlan, SourceRef } from "../../../src/shared/types/v9-contracts.js";

function makePlan(overrides: Partial<ConnectorEvolutionPlan> = {}): ConnectorEvolutionPlan {
  return {
    id: "plan-int-1",
    platformId: "moltbook",
    planType: "manifest_delta",
    payloadJson: "{}",
    status: "gating",
    sourceRefs: [{ family: "connector", id: "plan-int-1" } as SourceRef],
    createdAt: "2026-06-28T10:00:00Z",
    ...overrides,
  };
}

describe("INT-T8.2.2 rollback liveness gate", () => {
  it("infers rollback_failed when plan gating past time threshold", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const emitted: InferredRollbackEvent[] = [];
    let idCounter = 0;

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => [],
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:31Z"), // 31s later
      generateId: () => `inferred_${++idCounter}`,
    };

    const health = await rollbackHealthGate(deps, plan);

    // Watchdog inferred failure
    assert.equal(health.status, "blocked");
    assert.equal(health.inferred, true);
    assert.equal(health.reason, ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE);
    assert.equal(emitted.length, 1);

    // Inferred event has correct shape
    const event = emitted[0];
    assert.equal(event.stageKind, "rollback");
    assert.equal(event.status, "blocked");
    assert.equal(event.reasonCode, ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE);
  });

  it("aggregateLoopHealth sees inferred event → overall = blocked", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const emitted: InferredRollbackEvent[] = [];
    let idCounter = 0;

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => [],
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:31Z"),
      generateId: () => `inferred_${++idCounter}`,
    };

    await rollbackHealthGate(deps, plan);

    // Convert inferred event to StageEventInput for aggregateLoopHealth
    const stageEvents: StageEventInput[] = emitted.map((e) => ({
      stageKind: e.stageKind,
      status: e.status,
      reasonCode: e.reasonCode,
    }));

    const loopHealth = aggregateLoopHealth(
      { stageEvents, cycleTraces: [], activityHealth: [] },
      { currentCycleSequence: 1 },
    );

    assert.equal(loopHealth.overall, "blocked");
    assert.equal(loopHealth.rollbackBlocked, true);
    assert.ok(loopHealth.reasons.includes(ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE));
  });

  it("explicit rollback success → healthy, no inference", async () => {
    const plan = makePlan({ status: "rolled_back" });
    const events: StageEventForWatchdog[] = [
      {
        stageKind: "rollback",
        status: "ok",
        reasonCode: "rollback_succeeded",
        traceRefsJson: JSON.stringify([{ family: "connector", id: "plan-int-1" }]),
        observedAt: "2026-06-28T10:00:05Z",
      },
    ];
    const emitted: InferredRollbackEvent[] = [];

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => events,
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:31Z"),
      generateId: () => "should-not-be-called",
    };

    const health = await rollbackHealthGate(deps, plan);
    assert.equal(health.status, "healthy");
    assert.equal(emitted.length, 0);
  });

  it("explicit rollback failure → blocked, no inference", async () => {
    const plan = makePlan({ status: "blocked" });
    const events: StageEventForWatchdog[] = [
      {
        stageKind: "rollback",
        status: "blocked",
        reasonCode: "evolution_rollback_failed",
        traceRefsJson: JSON.stringify([{ family: "connector", id: "plan-int-1" }]),
        observedAt: "2026-06-28T10:00:05Z",
      },
    ];
    const emitted: InferredRollbackEvent[] = [];

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => events,
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:31Z"),
      generateId: () => "should-not-be-called",
    };

    const health = await rollbackHealthGate(deps, plan);
    assert.equal(health.status, "blocked");
    assert.equal(health.inferred, undefined);
    assert.equal(emitted.length, 0);
  });

  it("heartbeat-count inference triggers before time threshold", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const emitted: InferredRollbackEvent[] = [];
    let idCounter = 0;

    // 6 closure events but only 5s elapsed
    const events: StageEventForWatchdog[] = [];
    for (let i = 1; i <= 6; i++) {
      events.push({
        stageKind: "closure",
        status: "ok",
        reasonCode: "closure_completed",
        observedAt: `2026-06-28T10:00:0${i}Z`,
      });
    }

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => events,
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:05Z"), // 5s — within MAX_WAIT_MS
      generateId: () => `inferred_${++idCounter}`,
    };

    const health = await rollbackHealthGate(deps, plan);
    assert.equal(health.status, "blocked");
    assert.equal(health.inferred, true);
    assert.equal(emitted.length, 1);
  });

  it("plan within thresholds → degraded, no inference", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const emitted: InferredRollbackEvent[] = [];

    const deps: RollbackHealthGateDeps = {
      listStageEvents: async () => [],
      emitInferredEvent: async (event) => { emitted.push(event); },
      now: () => new Date("2026-06-28T10:00:05Z"), // 5s — within thresholds
      generateId: () => "should-not-be-called",
    };

    const health = await rollbackHealthGate(deps, plan);
    assert.equal(health.status, "degraded");
    assert.equal(health.reason, "rollback_pending");
    assert.equal(emitted.length, 0);
  });
});
