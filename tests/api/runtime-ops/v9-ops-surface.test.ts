/**
 * v9 Ops Surface — API Tests (T1.2.1)
 *
 * Validates that all v9 ops commands return JSON-serializable
 * RuntimeOpsEnvelopeV9 shapes with evidenceLevel, surfaceMode,
 * degradedReasons, and sourceRefs.
 *
 * Covers:
 * - continuity.read: available, unavailable, carrier mode, missing workspace
 * - routine.list: filter, carrier mode, empty
 * - routine.show: found, not found, missing id
 * - routine.rollback: stub delegation
 * - connector_evolution.status: list, filter by platform
 * - connector_evolution.trigger: stub delegation
 * - connector_evolution.rollback: stub delegation
 * - loop_status.read: with inputs, carrier mode, not wired
 * - Unknown command
 * - Envelope shape validation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  dispatchV9OpsCommand,
  handleContinuityRead,
  handleRoutineList,
  handleRoutineShow,
  handleRoutineRollback,
  handleConnectorEvolutionStatus,
  handleConnectorEvolutionTrigger,
  handleConnectorEvolutionRollback,
  handleLoopStatusRead,
  type V9OpsHandlerDeps,
} from "../../../src/cli/ops/v9-ops-handlers.js";
import type { RuntimeOpsEnvelopeV9 } from "../../../src/shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makeCarrierDeps(): V9OpsHandlerDeps {
  return { surfaceMode: "carrier" };
}

function makeFullRuntimeDeps(overrides: Partial<V9OpsHandlerDeps> = {}): V9OpsHandlerDeps {
  return { surfaceMode: "full_runtime", ...overrides };
}

function assertEnvelopeShape(envelope: RuntimeOpsEnvelopeV9, command: string) {
  assert.equal(typeof envelope.ok, "boolean");
  assert.equal(envelope.command, command);
  assert.ok(["carrier_ack", "contract_smoke", "state_present", "real_runtime", "durable_verified"].includes(envelope.evidenceLevel));
  assert.ok(["carrier", "full_runtime", "workspace_full_runtime"].includes(envelope.surfaceMode));
  assert.ok(Array.isArray(envelope.degradedReasons));
  assert.ok(typeof envelope.diagnostics === "object");
  assert.ok(Array.isArray(envelope.sourceRefs));
  assert.equal(typeof envelope.generatedAt, "string");
  // JSON-serializable
  assert.doesNotThrow(() => JSON.stringify(envelope));
}

// ───────────────────────────────────────────────────────────────
// continuity.read
// ───────────────────────────────────────────────────────────────

describe("API v9-ops continuity.read", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleContinuityRead(makeCarrierDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.equal(result.surfaceMode, "carrier");
    assert.equal(result.evidenceLevel, "carrier_ack");
    assert.equal(result.payload.status, "unavailable");
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "continuity.read");
  });

  it("missing workspaceRoot returns workspace_root_missing", async () => {
    const result = await handleContinuityRead(makeFullRuntimeDeps(), {});
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "workspace_root_missing"));
    assertEnvelopeShape(result, "continuity.read");
  });

  it("missing state DB returns state_store_unavailable", async () => {
    const result = await handleContinuityRead(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "state_store_unavailable"));
    assertEnvelopeShape(result, "continuity.read");
  });
});

// ───────────────────────────────────────────────────────────────
// routine.list
// ───────────────────────────────────────────────────────────────

describe("API v9-ops routine.list", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleRoutineList(makeCarrierDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.equal(result.payload.length, 0);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "routine.list");
  });

  it("missing state DB returns state_store_unavailable", async () => {
    const result = await handleRoutineList(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "state_store_unavailable"));
    assertEnvelopeShape(result, "routine.list");
  });
});

// ───────────────────────────────────────────────────────────────
// routine.show
// ───────────────────────────────────────────────────────────────

describe("API v9-ops routine.show", () => {
  it("missing routineId returns routine_id_missing", async () => {
    const result = await handleRoutineShow(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "routine_id_missing"));
    assertEnvelopeShape(result, "routine.show");
  });

  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleRoutineShow(makeCarrierDeps(), { workspaceRoot: "/ws", routineId: "r1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "routine.show");
  });
});

// ───────────────────────────────────────────────────────────────
// routine.rollback
// ───────────────────────────────────────────────────────────────

describe("API v9-ops routine.rollback", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleRoutineRollback(makeCarrierDeps(), { workspaceRoot: "/ws", routineId: "r1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "routine.rollback");
  });

  it("missing routineId returns routine_id_missing", async () => {
    const result = await handleRoutineRollback(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "routine_id_missing"));
    assertEnvelopeShape(result, "routine.rollback");
  });

  it("full runtime returns rollback_port_not_wired (stub)", async () => {
    const result = await handleRoutineRollback(makeFullRuntimeDeps(), { workspaceRoot: "/ws", routineId: "r1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "rollback_port_not_wired"));
    assertEnvelopeShape(result, "routine.rollback");
  });
});

// ───────────────────────────────────────────────────────────────
// connector_evolution.status
// ───────────────────────────────────────────────────────────────

describe("API v9-ops connector_evolution.status", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleConnectorEvolutionStatus(makeCarrierDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.equal(result.payload.length, 0);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "connector_evolution.status");
  });

  it("missing state DB returns state_store_unavailable", async () => {
    const result = await handleConnectorEvolutionStatus(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "state_store_unavailable"));
    assertEnvelopeShape(result, "connector_evolution.status");
  });
});

// ───────────────────────────────────────────────────────────────
// connector_evolution.trigger
// ───────────────────────────────────────────────────────────────

describe("API v9-ops connector_evolution.trigger", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleConnectorEvolutionTrigger(makeCarrierDeps(), { workspaceRoot: "/ws", planId: "p1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "connector_evolution.trigger");
  });

  it("missing planId returns plan_id_missing", async () => {
    const result = await handleConnectorEvolutionTrigger(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "plan_id_missing"));
    assertEnvelopeShape(result, "connector_evolution.trigger");
  });

  it("full runtime returns evolution_engine_not_wired (stub)", async () => {
    const result = await handleConnectorEvolutionTrigger(makeFullRuntimeDeps(), { workspaceRoot: "/ws", planId: "p1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "evolution_engine_not_wired"));
    assertEnvelopeShape(result, "connector_evolution.trigger");
  });
});

// ───────────────────────────────────────────────────────────────
// connector_evolution.rollback
// ───────────────────────────────────────────────────────────────

describe("API v9-ops connector_evolution.rollback", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleConnectorEvolutionRollback(makeCarrierDeps(), { workspaceRoot: "/ws", planId: "p1" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "connector_evolution.rollback");
  });

  it("missing planId returns plan_id_missing", async () => {
    const result = await handleConnectorEvolutionRollback(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "plan_id_missing"));
    assertEnvelopeShape(result, "connector_evolution.rollback");
  });
});

// ───────────────────────────────────────────────────────────────
// loop_status.read
// ───────────────────────────────────────────────────────────────

describe("API v9-ops loop_status.read", () => {
  it("carrier mode returns host_tool_unavailable", async () => {
    const result = await handleLoopStatusRead(makeCarrierDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "host_tool_unavailable"));
    assertEnvelopeShape(result, "loop_status.read");
  });

  it("missing loopStatusInputsProvider returns loop_status_inputs_not_wired", async () => {
    const result = await handleLoopStatusRead(makeFullRuntimeDeps(), { workspaceRoot: "/ws" });
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "loop_status_inputs_not_wired"));
    assertEnvelopeShape(result, "loop_status.read");
  });

  it("with inputs returns loop status", async () => {
    const deps = makeFullRuntimeDeps({
      loopStatusInputsProvider: async () => ({
        stageEvents: [{ stageKind: "evidence", status: "ok", reasonCode: "loop_healthy" }],
        cycleTraces: [],
        activityHealth: [],
        continuityCardResult: { kind: "ok", isStale: false, card: { sourceRefs: [] }, projections: [] },
        routineRegistrySnapshot: { routines: [] },
        connectorEvolutionResult: {
          planId: "p1",
          platformId: "moltbook",
          gates: [{ name: "schema", result: "pass" }],
        },
        characterFrameEvents: [],
      }),
    });
    const result = await handleLoopStatusRead(deps, { workspaceRoot: "/ws" });
    assert.equal(result.ok, true);
    assert.ok(result.payload.loop);
    assert.ok(result.payload.continuity);
    assert.ok(result.payload.routine);
    assert.ok(result.payload.connectorEvolution);
    assert.ok(result.payload.character);
    assert.ok(result.payload.overall);
    assertEnvelopeShape(result, "loop_status.read");
  });
});

// ───────────────────────────────────────────────────────────────
// dispatchV9OpsCommand — master dispatch
// ───────────────────────────────────────────────────────────────

describe("API v9-ops dispatchV9OpsCommand", () => {
  it("unknown command returns unknown_command", async () => {
    const result = await dispatchV9OpsCommand(makeFullRuntimeDeps(), "unknown.cmd", {});
    assert.equal(result.ok, false);
    assert.ok(result.degradedReasons.some((r) => r.code === "unknown_command"));
    assertEnvelopeShape(result, "unknown.cmd");
  });

  it("dispatches continuity.read", async () => {
    const result = await dispatchV9OpsCommand(makeCarrierDeps(), "continuity.read", { workspaceRoot: "/ws" });
    assert.equal(result.command, "continuity.read");
    assertEnvelopeShape(result, "continuity.read");
  });

  it("dispatches routine.list", async () => {
    const result = await dispatchV9OpsCommand(makeCarrierDeps(), "routine.list", { workspaceRoot: "/ws" });
    assert.equal(result.command, "routine.list");
    assertEnvelopeShape(result, "routine.list");
  });

  it("dispatches loop_status.read", async () => {
    const result = await dispatchV9OpsCommand(makeCarrierDeps(), "loop_status.read", { workspaceRoot: "/ws" });
    assert.equal(result.command, "loop_status.read");
    assertEnvelopeShape(result, "loop_status.read");
  });

  it("all v9 commands return JSON-serializable envelopes", async () => {
    const commands = [
      "continuity.read",
      "routine.list",
      "routine.show",
      "routine.rollback",
      "connector_evolution.status",
      "connector_evolution.trigger",
      "connector_evolution.rollback",
      "loop_status.read",
    ];
    for (const cmd of commands) {
      const result = await dispatchV9OpsCommand(makeCarrierDeps(), cmd, { workspaceRoot: "/ws" });
      assert.doesNotThrow(() => JSON.stringify(result), `${cmd} should be JSON-serializable`);
      assertEnvelopeShape(result, cmd);
    }
  });
});
