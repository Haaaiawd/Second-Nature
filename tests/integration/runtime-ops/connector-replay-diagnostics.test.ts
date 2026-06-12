/**
 * Connector Replay Diagnostics — Integration Test (T-OBS.R.4)
 *
 * Validates: loop_status explains connector replay root cause (cooldown_blocked)
 * without blaming generic governance and without leaking credentials.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";

describe("connector-replay-diagnostics", () => {
  function makeClosure(day: string, overrides: Record<string, unknown>) {
    return {
      id: `closure_${day}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cycleId: `cycle_${day}`,
      status: "denied" as const,
      closureStatus: "denied" as const,
      inputSummary: "test",
      outputSummary: "done",
      postProcessing: [],
      nextState: "ok",
      reason: "policy_denied_high_risk",
      platformId: "heartbeat",
      capabilityId: undefined,
      sourceRefs: [
        { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
      ],
      createdAt: `${day}T12:00:00Z`,
      closedAt: `${day}T12:00:00Z`,
      dispatchAttempt: 1,
      ...overrides,
    };
  }

  it("loop_status reports cooldown replay count", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      const cooldownPort = createConnectorCooldownPort(db);
      await cooldownPort.markFailure("moltbook", "feed.read", "auth_failure");
      await cooldownPort.markFailure("moltbook", "feed.read", "auth_failure");

      // Seed a production-shaped closure; replay attribution must come from durable cooldown state.
      await writeActionClosureRecord(db, makeClosure(day, {
        status: "downgraded",
        closureStatus: "downgraded",
        reason: "auth_failure",
        platformId: "moltbook",
        capabilityId: "feed.read",
      }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.cooldownReplayCount, 1);
      assert.ok(!result.status.nextAction.includes("governance"), "does not blame generic governance");
    } finally {
      db.close();
    }
  });

  it("loop_status does not leak credentials in diagnostics", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day, { reason: "auth_failure" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.connectorTerminalCount, 1);
      assert.ok(!JSON.stringify(result.status).includes("api-key"), "no credential leak");
      assert.ok(!JSON.stringify(result.status).includes("token"), "no token leak");
    } finally {
      db.close();
    }
  });
});
