import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createAgentGoalStore,
  type AgentGoalWrite,
  type AgentGoalStatusTransition,
} from "../../../src/storage/goal/agent-goal-store.js";

function makeGoal(overrides: Partial<AgentGoalWrite> = {}): AgentGoalWrite {
  return {
    goalId: `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: "short_term",
    status: "proposal",
    origin: "agent_proposed",
    description: "Improve connector onboarding",
    completionCriteria: "Manifest scan passes all tests",
    risk: "low",
    priorityHint: 5,
    sourceRefs: [{ sourceId: "dream-1", kind: "insight" }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("owner-set goal is accepted on write", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const goal = makeGoal({ origin: "owner_set", status: "accepted", acceptedBy: "owner" });
  const ack = await store.upsertAgentGoal(goal);
  assert.equal(ack.goalId, goal.goalId);

  const loaded = await store.loadAgentGoal(goal.goalId);
  assert.ok(loaded);
  assert.equal(loaded!.status, "accepted");
  assert.equal(loaded!.acceptedBy, "owner");
  assert.equal(loaded!.origin, "owner_set");
});

test("agent-proposed goal remains proposal by default", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const goal = makeGoal({ origin: "agent_proposed", status: "proposal" });
  await store.upsertAgentGoal(goal);

  const loaded = await store.loadAgentGoal(goal.goalId);
  assert.equal(loaded!.status, "proposal");
  assert.equal(loaded!.acceptedBy, undefined);
});

test("transitionGoalStatus from proposal to accepted with policy_allowlist", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const goal = makeGoal({ origin: "agent_proposed", status: "proposal" });
  await store.upsertAgentGoal(goal);

  const transition: AgentGoalStatusTransition = {
    goalId: goal.goalId,
    newStatus: "accepted",
    acceptedBy: "policy_allowlist",
    updatedAt: new Date().toISOString(),
  };
  const ack = await store.transitionGoalStatus(transition);
  assert.equal(ack.status, "acknowledged");

  const loaded = await store.loadAgentGoal(goal.goalId);
  assert.equal(loaded!.status, "accepted");
  assert.equal(loaded!.acceptedBy, "policy_allowlist");
});

test("transitionGoalStatus rejects proposal back to rejected", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const goal = makeGoal({ origin: "agent_proposed", status: "proposal" });
  await store.upsertAgentGoal(goal);

  await store.transitionGoalStatus({
    goalId: goal.goalId,
    newStatus: "rejected",
    updatedAt: new Date().toISOString(),
  });

  const loaded = await store.loadAgentGoal(goal.goalId);
  assert.equal(loaded!.status, "rejected");
});

test("listAgentGoals filters by status", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const g1 = makeGoal({ status: "accepted", origin: "owner_set", scope: "global" });
  const g2 = makeGoal({ status: "proposal", origin: "agent_proposed", scope: "moltbook" });
  const g3 = makeGoal({ status: "completed", origin: "owner_set", scope: "instreet" });
  await store.upsertAgentGoal(g1);
  await store.upsertAgentGoal(g2);
  await store.upsertAgentGoal(g3);

  const accepted = await store.listAgentGoals({ statuses: ["accepted"] });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]!.goalId, g1.goalId);

  const active = await store.listAgentGoals({ statuses: ["accepted", "proposal"] });
  assert.equal(active.length, 2);
});

test("listAgentGoals filters by origin", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const g1 = makeGoal({ origin: "owner_set" });
  const g2 = makeGoal({ origin: "agent_proposed" });
  await store.upsertAgentGoal(g1);
  await store.upsertAgentGoal(g2);

  const ownerSet = await store.listAgentGoals({ origins: ["owner_set"] });
  assert.equal(ownerSet.length, 1);
  assert.equal(ownerSet[0]!.origin, "owner_set");
});

test("loadAgentGoal returns null for missing goal", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const loaded = await store.loadAgentGoal("missing");
  assert.equal(loaded, null);
});

test("goal update preserves createdAt and changes updatedAt", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const created = new Date(Date.now() - 86400000).toISOString();
  const goal = makeGoal({ createdAt: created, updatedAt: created });
  await store.upsertAgentGoal(goal);

  const updated = new Date().toISOString();
  await store.upsertAgentGoal({ ...goal, description: "Updated", updatedAt: updated });

  const loaded = await store.loadAgentGoal(goal.goalId);
  assert.equal(loaded!.createdAt, created);
  assert.equal(loaded!.updatedAt, updated);
  assert.equal(loaded!.description, "Updated");
});

// ─── T-V7C.C.4: goal dedupe ────────────────────────────────────────────────

test("upsert accepted goal marks old same-kind-scope as replaced", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const oldGoal = makeGoal({ status: "accepted", origin: "owner_set", scope: "global", acceptedBy: "owner" });
  const newGoal = makeGoal({ status: "accepted", origin: "owner_set", scope: "global", acceptedBy: "owner" });

  await store.upsertAgentGoal(oldGoal);
  await store.upsertAgentGoal(newGoal);

  const oldLoaded = await store.loadAgentGoal(oldGoal.goalId);
  assert.equal(oldLoaded!.status, "replaced");

  const newLoaded = await store.loadAgentGoal(newGoal.goalId);
  assert.equal(newLoaded!.status, "accepted");
});

test("upsert accepted goal does NOT replace different scope", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const globalGoal = makeGoal({ status: "accepted", scope: "global", acceptedBy: "owner" });
  const platformGoal = makeGoal({ status: "accepted", scope: "moltbook", acceptedBy: "owner" });

  await store.upsertAgentGoal(globalGoal);
  await store.upsertAgentGoal(platformGoal);

  const globalLoaded = await store.loadAgentGoal(globalGoal.goalId);
  assert.equal(globalLoaded!.status, "accepted");

  const platformLoaded = await store.loadAgentGoal(platformGoal.goalId);
  assert.equal(platformLoaded!.status, "accepted");
});

test("listAgentGoals dedupes by kind+scope keeping newest", async () => {
  const db = createStateDatabase(":memory:");
  const store = createAgentGoalStore(db);

  const now = Date.now();
  const oldGoal = makeGoal({
    status: "accepted", scope: "global", acceptedBy: "owner",
    updatedAt: new Date(now - 1000).toISOString(),
  });
  const newGoal = makeGoal({
    status: "accepted", scope: "global", acceptedBy: "owner",
    updatedAt: new Date(now).toISOString(),
  });
  // Insert old as "replaced" manually to simulate a race condition where DB still has both accepted
  await store.upsertAgentGoal(oldGoal);
  await store.upsertAgentGoal(newGoal);
  // Force old back to accepted to test listAgentGoals dedupe
  await store.transitionGoalStatus({
    goalId: oldGoal.goalId,
    newStatus: "accepted",
    updatedAt: oldGoal.updatedAt,
  });

  const listed = await store.listAgentGoals({ statuses: ["accepted"] });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.goalId, newGoal.goalId);
});
