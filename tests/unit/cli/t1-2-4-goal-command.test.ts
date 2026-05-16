/**
 * Unit coverage for `goalCommand` (T1.2.4).
 *
 * Verifies set/list/accept/reject operations, status transitions,
 * missing-input errors, state-unavailable path, and before/after state.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase, type StateDatabase } from "../../../src/storage/db/index.js";
import { goalCommand } from "../../../src/cli/commands/goal.js";

function tmpDb(): { db: StateDatabase; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-goal-test-"));
  const dbPath = path.join(dir, "test.db");
  const db = createStateDatabase(dbPath);
  return {
    db,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("T1.2.4 goal set creates owner-set accepted goal with before/after", async () => {
  const { db, cleanup } = tmpDb();

  const result = await goalCommand(db, {
    action: "set",
    description: "完善 EvoMap profile",
    completionCriteria: "profile 完整度 > 80%",
    risk: "low",
    kind: "short_term",
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "set");

  const data = result.data as Record<string, unknown>;
  const goal = data.goal as Record<string, unknown>;
  assert.equal(goal.status, "accepted");
  assert.equal(goal.origin, "owner_set");
  assert.equal(goal.acceptedBy, "owner");
  assert.equal(goal.description, "完善 EvoMap profile");
  assert.equal(goal.completionCriteria, "profile 完整度 > 80%");

  const after = data.after as Record<string, unknown>;
  assert.equal(after.status, "accepted");
  assert.equal(after.origin, "owner_set");

  cleanup();
});

test("T1.2.4 goal set without description returns missing error", async () => {
  const { db, cleanup } = tmpDb();

  const result = await goalCommand(db, { action: "set", description: "" });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "MISSING_DESCRIPTION");

  cleanup();
});

test("T1.2.4 goal list returns created goals", async () => {
  const { db, cleanup } = tmpDb();

  await goalCommand(db, {
    action: "set",
    description: "Goal A",
    completionCriteria: "criteria A",
  });
  await goalCommand(db, {
    action: "set",
    description: "Goal B",
    completionCriteria: "criteria B",
    kind: "long_term",
    risk: "medium",
  });

  const result = await goalCommand(db, { action: "list" });
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  assert.equal(data.total, 2);

  const goals = data.goals as Array<Record<string, unknown>>;
  assert.equal(goals.length, 2);
  assert.ok(goals.some((g) => g.description === "Goal A"));
  assert.ok(goals.some((g) => g.description === "Goal B"));

  cleanup();
});

test("T1.2.4 goal list filters by status and origin", async () => {
  const { db, cleanup } = tmpDb();

  // Create an accepted owner-set goal
  await goalCommand(db, {
    action: "set",
    description: "Accepted goal",
  });

  // Create a proposal goal manually
  const store = (await import("../../../src/storage/goal/agent-goal-store.js")).createAgentGoalStore(db);
  await store.upsertAgentGoal({
    goalId: "proposal-1",
    kind: "short_term",
    status: "proposal",
    origin: "agent_proposed",
    description: "Proposed goal",
    completionCriteria: "",
    risk: "low",
    priorityHint: 0,
    sourceRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const acceptedResult = await goalCommand(db, { action: "list", statusFilter: "accepted" });
  const acceptedData = acceptedResult.data as Record<string, unknown>;
  assert.equal(acceptedData.total, 1);

  const proposalResult = await goalCommand(db, { action: "list", statusFilter: "proposal" });
  const proposalData = proposalResult.data as Record<string, unknown>;
  assert.equal(proposalData.total, 1);

  cleanup();
});

test("T1.2.4 goal accept transitions proposal to accepted with before/after", async () => {
  const { db, cleanup } = tmpDb();

  const store = (await import("../../../src/storage/goal/agent-goal-store.js")).createAgentGoalStore(db);
  await store.upsertAgentGoal({
    goalId: "test-proposal",
    kind: "short_term",
    status: "proposal",
    origin: "agent_proposed",
    description: "Agent proposed goal",
    completionCriteria: "",
    risk: "low",
    priorityHint: 0,
    sourceRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const result = await goalCommand(db, {
    action: "accept",
    goalId: "test-proposal",
  });

  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  const before = data.before as Record<string, unknown>;
  const after = data.after as Record<string, unknown>;
  assert.equal(before.status, "proposal");
  assert.equal(after.status, "accepted");
  assert.equal(after.acceptedBy, "owner");

  cleanup();
});

test("T1.2.4 goal accept non-proposal returns invalid transition error", async () => {
  const { db, cleanup } = tmpDb();

  await goalCommand(db, {
    action: "set",
    description: "Already accepted",
    goalId: "already-accepted",
  });

  const result = await goalCommand(db, {
    action: "accept",
    goalId: "already-accepted",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "INVALID_STATUS_TRANSITION");

  cleanup();
});

test("T1.2.4 goal reject transitions proposal to rejected with before/after", async () => {
  const { db, cleanup } = tmpDb();

  const store = (await import("../../../src/storage/goal/agent-goal-store.js")).createAgentGoalStore(db);
  await store.upsertAgentGoal({
    goalId: "test-reject",
    kind: "short_term",
    status: "proposal",
    origin: "agent_proposed",
    description: "Reject me",
    completionCriteria: "",
    risk: "low",
    priorityHint: 0,
    sourceRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const result = await goalCommand(db, {
    action: "reject",
    goalId: "test-reject",
  });

  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  const before = data.before as Record<string, unknown>;
  const after = data.after as Record<string, unknown>;
  assert.equal(before.status, "proposal");
  assert.equal(after.status, "rejected");

  cleanup();
});

test("T1.2.4 goal accept missing goalId returns error", async () => {
  const { db, cleanup } = tmpDb();

  const result = await goalCommand(db, { action: "accept" });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "MISSING_GOAL_ID");

  cleanup();
});

test("T1.2.4 goal accept unknown goalId returns not found", async () => {
  const { db, cleanup } = tmpDb();

  const result = await goalCommand(db, { action: "accept", goalId: "unknown" });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "GOAL_NOT_FOUND");

  cleanup();
});

test("T1.2.4 goal command without state returns STATE_UNAVAILABLE", async () => {
  const result = await goalCommand(undefined, { action: "list" });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "STATE_UNAVAILABLE");
});

test("T1.2.4 goal command unknown action returns error", async () => {
  const { db, cleanup } = tmpDb();

  const result = await goalCommand(db, { action: "delete" as "set" });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "UNKNOWN_GOAL_ACTION");

  cleanup();
});
