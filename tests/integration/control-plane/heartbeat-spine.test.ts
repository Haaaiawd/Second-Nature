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

// ─── T2.2.1: Heartbeat Decision Loop Tests ──────────────────────────────────
//
// Three representative scenarios per task spec:
// 1. no obligation → no action selected (heartbeat_ok or denied)
// 2. no viable intent → heartbeat_ok
// 3. guard deny → denied

test("T2.2.1 [no obligation] all candidates blocked by guard → denied", async () => {
  // No obligations, but planner still produces exploration/social/outreach candidates.
  // With awaitingUserInput=true, all candidates are blocked by the awaiting_user guard.
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-03-31T10:00:00Z" },
  };

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
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "denied");
  assert.ok(result.reasons.some((r) => r.includes("awaiting_user")));
});

test("T2.2.1 [no viable intent] quiet mode with all candidates blocked → denied", async () => {
  // In quiet mode, maintenance/reflection intents are normally allowed.
  // Add awaitingUserInput to block them, plus duplicate intents for exploration/social.
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-03-31T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "quiet",
      currentWindowId: "window-quiet",
      pendingObligations: [],
      recentOutreachHashes: ["h1", "h2", "h3", "h4"],
      deniedIntents: [
        { intentHash: "exploration:scan platform opportunities", reason: "duplicate_intent", at: "2026-03-31T09:00:00Z" },
        { intentHash: "social:engage social platforms", reason: "duplicate_intent", at: "2026-03-31T09:00:00Z" },
      ],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: true,
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "denied");
  assert.ok(result.reasons.some((r) => r.includes("awaiting_user") || r.includes("duplicate_intent")));
});

test("T2.2.1 [guard deny] budget exceeded blocks social, other intents also blocked → denied", async () => {
  // Budget exceeded blocks social. Exploration passes budget check but is blocked by awaitingUserInput.
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-03-31T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "active",
      currentWindowId: "window-default",
      pendingObligations: [],
      recentOutreachHashes: ["h1", "h2", "h3", "h4"],
      deniedIntents: [],
      budgets: { socialUsed: 5, socialLimit: 5 },
      awaitingUserInput: true,
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "denied");
  assert.ok(result.reasons.some((r) => r.includes("budget_exceeded") || r.includes("awaiting_user")));
});

test("T2.2.1 has obligation and allow → intent_selected", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-03-31T10:00:00Z" },
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
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "intent_selected");
  assert.ok(result.selectedIntentId?.startsWith("intent-obligation"));
});

test("T2.2.1 duplicate hard-guard defers single maintenance candidate → deferred", async () => {
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-03-31T10:00:00Z" },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => ({
      mode: "paused_for_interrupt",
      currentWindowId: "window-default",
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
      duplicateIntentKeys: ["maintenance:checks"],
    }),
  };

  const result = await ingestRhythmSignal(signal, deps);

  assert.equal(result.scope, "rhythm");
  assert.equal(result.status, "deferred");
  assert.ok(result.reasons.some((r) => r.includes("duplicate_intent")));
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
