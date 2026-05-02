import test from "node:test";
import assert from "node:assert/strict";

import {
  runHeartbeatCycle,
  type HeartbeatSignal,
  type HeartbeatDeps,
} from "../../../src/core/second-nature/heartbeat/index.js";

test("T2.1.1 runtime unavailable returns runtime_carrier_only without lived loop", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T10:00:00Z" },
  };

  const result = await runHeartbeatCycle({
    signal,
    runtimeAvailable: false,
    deps: {
      loadSnapshotInputs: async () => {
        throw new Error("snapshot_should_not_load_when_runtime_unavailable");
      },
    },
  });

  assert.equal(result.status, "runtime_carrier_only");
  assert.equal(result.scope, "rhythm");
  assert.ok(result.reasons.includes("runtime_unavailable_no_lived_experience_loop"));
});

test("T2.1.1 user_task bypasses rhythm gate → heartbeat_ok", async () => {
  const signal: HeartbeatSignal = {
    trigger: "user_task",
    payload: { timestamp: "2026-05-02T10:00:00Z" },
  };

  const result = await runHeartbeatCycle({
    signal,
    runtimeAvailable: true,
    deps: {
      loadSnapshotInputs: async () => {
        throw new Error("snapshot_should_not_load_for_user_task_bypass");
      },
    },
  });

  assert.equal(result.scope, "user_task");
  assert.equal(result.status, "heartbeat_ok");
  assert.ok(result.reasons.includes("rhythm_gate_bypass_user_task"));
});

test("T2.1.1 user_reply returns light continuity skeleton", async () => {
  const signal: HeartbeatSignal = {
    trigger: "user_reply",
    payload: { timestamp: "2026-05-02T10:00:00Z" },
  };

  const result = await runHeartbeatCycle({
    signal,
    runtimeAvailable: true,
    deps: {
      loadSnapshotInputs: async () => {
        throw new Error("snapshot_should_not_load_for_user_reply_skeleton");
      },
    },
  });

  assert.equal(result.scope, "user_reply");
  assert.equal(result.status, "heartbeat_ok");
  assert.ok(result.reasons.some((r) => r.includes("user_reply")));
});

test("T2.1.1 rhythm path delegates to loop → silent_no_candidates when empty", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "maintenance_only",
      currentWindowId: "window-default",
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
    }),
  };

  const result = await runHeartbeatCycle({ signal, runtimeAvailable: true, deps });

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "heartbeat_ok");
  assert.ok(result.reasons.includes("silent_no_candidates"));
});
