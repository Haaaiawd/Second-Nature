import test from "node:test";
import assert from "node:assert/strict";

import {
  buildContinuitySnapshot,
  ingestRhythmSignal,
  routeScopedInput,
  type HeartbeatSignal,
  type HeartbeatDeps,
  type SnapshotInputs,
  type ScopedRuntimeInput,
} from "../../../src/core/second-nature/heartbeat/index.js";

// ─── T2.1.1: Snapshot Builder Tests ────────────────────────────────────────

test("T2.1.1 buildContinuitySnapshot creates valid snapshot from inputs", () => {
  const inputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "window-morning",
    pendingObligations: ["check-email"],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
    awaitingUserInput: false,
    riskSuppressed: false,
  };

  const snapshot = buildContinuitySnapshot(inputs);

  assert.equal(snapshot.mode, "active");
  assert.equal(snapshot.currentWindowId, "window-morning");
  assert.deepEqual(snapshot.pendingObligations, ["check-email"]);
  assert.deepEqual(snapshot.recentOutreachHashes, []);
  assert.deepEqual(snapshot.budgets, { socialUsed: 0, socialLimit: 5 });
  assert.equal(snapshot.awaitingUserInput, false);
});

test("T2.1.1 buildContinuitySnapshot handles quiet mode", () => {
  const inputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: ["hash1", "hash2"],
    deniedIntents: [{ intentHash: "outreach:routine", reason: "too_soon", at: "2026-03-31T10:00:00Z" }],
    budgets: { socialUsed: 3, socialLimit: 5 },
  };

  const snapshot = buildContinuitySnapshot(inputs);

  assert.equal(snapshot.mode, "quiet");
  assert.equal(snapshot.recentOutreachHashes.length, 2);
  assert.equal(snapshot.deniedIntents.length, 1);
});

test("T2.1.1 ingestRhythmSignal returns HEARTBEAT_OK when awaiting user input blocks all intents", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: {
      timestamp: "2026-03-31T10:00:00Z",
    },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 5, socialLimit: 5 },
      awaitingUserInput: true,
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "heartbeat_ok");
  assert.ok(result.reasons.includes("no_viable_intent"));
});

test("T2.1.1 ingestRhythmSignal selects intent when obligation exists", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: {
      timestamp: "2026-03-31T10:00:00Z",
    },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: ["check-email"],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "intent_selected");
  assert.ok(result.selectedIntentId?.startsWith("intent-obligation"));
});

test("T2.1.1 ingestRhythmSignal returns HEARTBEAT_OK in quiet mode with no maintenance candidates", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: {
      timestamp: "2026-03-31T10:00:00Z",
    },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "quiet",
      currentWindowId: "window-quiet",
      pendingObligations: [],
      recentOutreachHashes: ["h1", "h2", "h3", "h4"],
      deniedIntents: [],
      budgets: { socialUsed: 5, socialLimit: 5 },
      awaitingUserInput: true,
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.status, "heartbeat_ok");
  assert.ok(result.reasons.includes("no_viable_intent"));
});

// ─── T2.1.2: Scope Router Tests ─────────────────────────────────────────────

test("T2.1.2 routeScopedInput routes heartbeat_bridge to rhythm", () => {
  const input: ScopedRuntimeInput = {
    trigger: "heartbeat_bridge",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.trigger, "heartbeat_bridge");
  assert.equal(result.handled, true);
});

test("T2.1.2 routeScopedInput routes user_task to user_task", () => {
  const input: ScopedRuntimeInput = {
    trigger: "user_task",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "user_task");
  assert.equal(result.trigger, "user_task");
});

test("T2.1.2 routeScopedInput routes user_reply to user_reply", () => {
  const input: ScopedRuntimeInput = {
    trigger: "user_reply",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "user_reply");
  assert.equal(result.trigger, "user_reply");
});

test("T2.1.2 routeScopedInput respects explicit scopeHint over trigger mapping", () => {
  const input: ScopedRuntimeInput = {
    trigger: "heartbeat_bridge",
    scopeHint: "user_task",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "user_task");
});

test("T2.1.2 routeScopedInput defaults unknown trigger to rhythm", () => {
  const input: ScopedRuntimeInput = {
    trigger: "interrupt",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "rhythm");
});

test("T2.1.2 routeScopedInput handles resume trigger as rhythm", () => {
  const input: ScopedRuntimeInput = {
    trigger: "resume",
    payload: {},
  };

  const result = routeScopedInput(input);

  assert.equal(result.scope, "rhythm");
});
