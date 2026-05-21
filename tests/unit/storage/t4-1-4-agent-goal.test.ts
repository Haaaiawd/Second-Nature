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

  const g1 = makeGoal({ status: "accepted", origin: "owner_set" });
  const g2 = makeGoal({ status: "proposal", origin: "agent_proposed" });
  const g3 = makeGoal({ status: "completed", origin: "owner_set" });
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
