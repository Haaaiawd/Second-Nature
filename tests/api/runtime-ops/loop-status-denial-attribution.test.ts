/**
 * LoopStatus Denial Attribution — API Tests (T-OBS.R.4)
 *
 * Validates: readLoopStatus surfaces denial/replay attribution counts
 * instead of a single aggregated decision_denied counter.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";

describe("loop-status-denial-attribution API", () => {
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

  it("exposes policy denied count from closures", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day, { reason: "policy_denied_high_risk" }));
      await writeActionClosureRecord(db, makeClosure(day, { reason: "policy_denied_missing_permission" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.policyDeniedCount, 2);
      assert.equal(result.status.hardGuardDeniedCount, 0);
    } finally {
      db.close();
    }
  });

  it("exposes hard guard count for source/affordance denials", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day, { reason: "source_refs_missing" }));
      await writeActionClosureRecord(db, makeClosure(day, { reason: "affordance_unavailable" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.hardGuardDeniedCount, 2);
      assert.equal(result.status.policyDeniedCount, 0);
    } finally {
      db.close();
    }
  });

  it("exposes source absence count", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day, { status: "no_action", closureStatus: "no_action", reason: "evidence_batch_empty" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.sourceAbsenceCount, 1);
    } finally {
      db.close();
    }
  });

  it("exposes cooldown replay count from durable cooldown state", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      const cooldownPort = createConnectorCooldownPort(db);
      await cooldownPort.markFailure("moltbook", "feed.read", "auth_failure");
      await cooldownPort.markFailure("moltbook", "feed.read", "auth_failure");
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
      assert.equal(result.status.connectorTerminalCount, 0);
    } finally {
      db.close();
    }
  });

  it("does not leak credentials in diagnostics", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day, { status: "completed", closureStatus: "completed", reason: "auth_failure" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status.connectorTerminalCount, 1);
      const statusJson = JSON.stringify(result.status);
      assert.ok(!statusJson.includes("api-key"), "no api-key leak");
      assert.ok(!statusJson.includes("token"), "no token leak");
    } finally {
      db.close();
    }
  });
});
