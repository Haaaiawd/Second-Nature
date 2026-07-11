/**
 * v9 Rollback Liveness Watchdog — Unit Tests (T8.2.2)
 *
 * Validates:
 * - Success: rollback success event → healthy
 * - Explicit failure: rollback failure event → blocked (not inferred)
 * - Timeout inference: plan gating past MAX_WAIT_MS → blocked (inferred)
 * - Heartbeat-count inference: plan gating past MAX_HEARTBEATS → blocked (inferred)
 * - Pending: plan gating within thresholds → degraded
 * - No monitoring needed: plan activated/rolled_back → degraded (not monitored)
 * - Batch evaluation
 * - needsWatchdogMonitoring
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  rollbackHealthGate,
  rollbackHealthGateBatch,
  needsWatchdogMonitoring,
  ROLLBACK_WATCHDOG,
  type RollbackHealthGateDeps,
  type StageEventForWatchdog,
  type InferredRollbackEvent,
} from "../../../src/observability/v9-rollback-health-gate.js";
import type { ConnectorEvolutionPlan, SourceRef } from "../../../src/shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<ConnectorEvolutionPlan> = {}): ConnectorEvolutionPlan {
  return {
    id: "plan-1",
    platformId: "moltbook",
    planType: "manifest_delta",
    payloadJson: "{}",
    status: "gating",
    sourceRefs: [{ family: "connector", id: "plan-1" } as SourceRef],
    createdAt: "2026-06-28T10:00:00Z",
    ...overrides,
  };
}

function makeDeps(
  events: StageEventForWatchdog[] = [],
  now: Date = new Date("2026-06-28T10:00:10Z"),
): {
  deps: RollbackHealthGateDeps;
  emitted: InferredRollbackEvent[];
} {
  const emitted: InferredRollbackEvent[] = [];
  let idCounter = 0;
  return {
    deps: {
      listStageEvents: async () => events,
      emitInferredEvent: async (event: InferredRollbackEvent) => {
        emitted.push(event);
      },
      now: () => now,
      generateId: () => `inferred_${++idCounter}`,
    },
    emitted,
  };
}

function makeRollbackEvent(
  status: string,
  reasonCode: string,
  planId: string,
  observedAt: string,
): StageEventForWatchdog {
  return {
    stageKind: "rollback",
    status,
    reasonCode,
    traceRefsJson: JSON.stringify([{ family: "connector", id: planId }]),
    observedAt,
  };
}

function makeClosureEvent(observedAt: string): StageEventForWatchdog {
  return {
    stageKind: "closure",
    status: "ok",
    reasonCode: "closure_completed",
    observedAt,
  };
}

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — success
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — success", () => {
  it("returns healthy when rollback success event found", async () => {
    const plan = makePlan({ status: "rolled_back" });
    const { deps } = makeDeps([
      makeRollbackEvent("ok", "rollback_succeeded", "plan-1", "2026-06-28T10:00:05Z"),
    ]);
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "healthy");
    assert.equal(result.rollbackBlocked, false);
  });

  it("does not emit inferred event on success", async () => {
    const plan = makePlan({ status: "rolled_back" });
    const { deps, emitted } = makeDeps([
      makeRollbackEvent("ok", "rollback_succeeded", "plan-1", "2026-06-28T10:00:05Z"),
    ]);
    await rollbackHealthGate(deps, plan);
    assert.equal(emitted.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — explicit failure
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — explicit failure", () => {
  it("returns blocked when rollback failure event found", async () => {
    const plan = makePlan({ status: "blocked" });
    const { deps } = makeDeps([
      makeRollbackEvent("blocked", "evolution_rollback_failed", "plan-1", "2026-06-28T10:00:05Z"),
    ]);
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "blocked");
    assert.equal(result.rollbackBlocked, true);
    assert.equal(result.reason, "evolution_rollback_failed");
    assert.equal(result.inferred, undefined);
  });

  it("does not emit inferred event on explicit failure", async () => {
    const plan = makePlan({ status: "blocked" });
    const { deps, emitted } = makeDeps([
      makeRollbackEvent("blocked", "evolution_rollback_failed", "plan-1", "2026-06-28T10:00:05Z"),
    ]);
    await rollbackHealthGate(deps, plan);
    assert.equal(emitted.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — timeout inference
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — timeout inference", () => {
  it("infers rollback_failed when elapsed > MAX_WAIT_MS", async () => {
    const plan = makePlan({
      status: "gating",
      createdAt: "2026-06-28T10:00:00Z",
    });
    // Now is 31s later — past MAX_WAIT_MS (30s)
    const { deps, emitted } = makeDeps([], new Date("2026-06-28T10:00:31Z"));
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "blocked");
    assert.equal(result.rollbackBlocked, true);
    assert.equal(result.reason, ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE);
    assert.equal(result.inferred, true);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].reasonCode, ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE);
    assert.equal(emitted[0].stageKind, "rollback");
    assert.equal(emitted[0].status, "blocked");
  });

  it("emitted event contains planId and inferred=true in payload", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const { deps, emitted } = makeDeps([], new Date("2026-06-28T10:00:31Z"));
    await rollbackHealthGate(deps, plan);
    const payload = JSON.parse(emitted[0].payloadJson);
    assert.equal(payload.planId, "plan-1");
    assert.equal(payload.inferred, true);
  });

  it("emitted event traceRefs contain plan id", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const { deps, emitted } = makeDeps([], new Date("2026-06-28T10:00:31Z"));
    await rollbackHealthGate(deps, plan);
    const traceRefs = JSON.parse(emitted[0].traceRefsJson);
    assert.equal(traceRefs[0].id, "plan-1");
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — heartbeat-count inference
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — heartbeat-count inference", () => {
  it("infers rollback_failed when heartbeat count > MAX_HEARTBEATS", async () => {
    const plan = makePlan({
      status: "gating",
      createdAt: "2026-06-28T10:00:00Z",
    });
    // 6 closure events — past MAX_HEARTBEATS_WITHOUT_EVENT (5)
    const events: StageEventForWatchdog[] = [];
    for (let i = 1; i <= 6; i++) {
      events.push(makeClosureEvent(`2026-06-28T10:00:0${i}Z`));
    }
    // Only 5s elapsed — within MAX_WAIT_MS
    const { deps, emitted } = makeDeps(events, new Date("2026-06-28T10:00:05Z"));
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "blocked");
    assert.equal(result.inferred, true);
    assert.equal(emitted.length, 1);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — pending
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — pending", () => {
  it("returns degraded when plan gating within thresholds", async () => {
    const plan = makePlan({
      status: "gating",
      createdAt: "2026-06-28T10:00:00Z",
    });
    // Only 5s elapsed, 0 heartbeats — within thresholds
    const { deps, emitted } = makeDeps([], new Date("2026-06-28T10:00:05Z"));
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "degraded");
    assert.equal(result.rollbackBlocked, false);
    assert.equal(result.reason, "rollback_pending");
    assert.equal(emitted.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — no monitoring needed
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — no monitoring needed", () => {
  it("returns degraded for activated plan without rollback events", async () => {
    const plan = makePlan({ status: "activated" });
    const { deps, emitted } = makeDeps([]);
    const result = await rollbackHealthGate(deps, plan);
    // activated plan doesn't expect rollback → degraded (pending)
    assert.equal(result.status, "degraded");
    assert.equal(emitted.length, 0);
  });

  it("returns degraded for proposed plan without rollback events", async () => {
    const plan = makePlan({ status: "proposed" });
    const { deps, emitted } = makeDeps([]);
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "degraded");
    assert.equal(emitted.length, 0);
  });

  it("does not infer failure for rolled_back plan even past threshold", async () => {
    const plan = makePlan({
      status: "rolled_back",
      createdAt: "2026-06-28T10:00:00Z",
    });
    // 31s later but no rollback events — rolled_back status doesn't trigger inference
    const { deps, emitted } = makeDeps([], new Date("2026-06-28T10:00:31Z"));
    const result = await rollbackHealthGate(deps, plan);
    // No success event found, but plan is rolled_back → degraded (not inferred)
    assert.equal(result.status, "degraded");
    assert.equal(emitted.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate — event filtering
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGate — event filtering", () => {
  it("only matches rollback events for this plan id", async () => {
    const plan = makePlan({ id: "plan-1", status: "rolled_back" });
    const events = [
      // Success event for a DIFFERENT plan
      makeRollbackEvent("ok", "rollback_succeeded", "plan-2", "2026-06-28T10:00:05Z"),
    ];
    const { deps } = makeDeps(events);
    const result = await rollbackHealthGate(deps, plan);
    // No matching success for plan-1 → degraded
    assert.equal(result.status, "degraded");
  });

  it("ignores non-rollback stage events", async () => {
    const plan = makePlan({ status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const events: StageEventForWatchdog[] = [
      {
        stageKind: "evidence",
        status: "ok",
        reasonCode: "loop_healthy",
        traceRefsJson: JSON.stringify([{ family: "connector", id: "plan-1" }]),
        observedAt: "2026-06-28T10:00:05Z",
      },
    ];
    // 31s later — past MAX_WAIT_MS, but no rollback events
    const { deps, emitted } = makeDeps(events, new Date("2026-06-28T10:00:31Z"));
    const result = await rollbackHealthGate(deps, plan);
    assert.equal(result.status, "blocked");
    assert.equal(result.inferred, true);
    assert.equal(emitted.length, 1);
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackHealthGateBatch
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 rollbackHealthGateBatch", () => {
  it("evaluates multiple plans and collects inferred failures", async () => {
    const plan1 = makePlan({ id: "plan-1", status: "gating", createdAt: "2026-06-28T10:00:00Z" });
    const plan2 = makePlan({ id: "plan-2", status: "rolled_back", createdAt: "2026-06-28T10:00:00Z" });
    const plan3 = makePlan({ id: "plan-3", status: "gating", createdAt: "2026-06-28T10:00:00Z" });

    const events: StageEventForWatchdog[] = [
      makeRollbackEvent("ok", "rollback_succeeded", "plan-2", "2026-06-28T10:00:05Z"),
    ];

    const { deps } = makeDeps(events, new Date("2026-06-28T10:00:31Z"));
    const result = await rollbackHealthGateBatch(deps, [plan1, plan2, plan3]);

    assert.equal(result.results.length, 3);
    assert.equal(result.results[0].planId, "plan-1");
    assert.equal(result.results[0].health.status, "blocked");
    assert.equal(result.results[1].planId, "plan-2");
    assert.equal(result.results[1].health.status, "healthy");
    assert.equal(result.results[2].planId, "plan-3");
    assert.equal(result.results[2].health.status, "blocked");

    assert.equal(result.inferredFailures.length, 2);
    assert.ok(result.inferredFailures.includes("plan-1"));
    assert.ok(result.inferredFailures.includes("plan-3"));
  });

  it("returns empty results for empty plans", async () => {
    const { deps } = makeDeps([]);
    const result = await rollbackHealthGateBatch(deps, []);
    assert.equal(result.results.length, 0);
    assert.equal(result.inferredFailures.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────
// needsWatchdogMonitoring
// ───────────────────────────────────────────────────────────────

describe("T8.2.2 needsWatchdogMonitoring", () => {
  it("returns true for gating plan", () => {
    assert.ok(needsWatchdogMonitoring(makePlan({ status: "gating" })));
  });

  it("returns true for blocked plan", () => {
    assert.ok(needsWatchdogMonitoring(makePlan({ status: "blocked" })));
  });

  it("returns false for activated plan", () => {
    assert.ok(!needsWatchdogMonitoring(makePlan({ status: "activated" })));
  });

  it("returns false for rolled_back plan", () => {
    assert.ok(!needsWatchdogMonitoring(makePlan({ status: "rolled_back" })));
  });

  it("returns false for proposed plan", () => {
    assert.ok(!needsWatchdogMonitoring(makePlan({ status: "proposed" })));
  });
});
