/**
 * T-SMS.C.3 — GoalLifecycleStore 单元测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createGoalLifecycleStore } from "../../../src/storage/services/goal-lifecycle-store.js";
import type { AgentGoalWrite } from "../../../src/shared/types/goal.js";

describe("GoalLifecycleStore", () => {
  it("upserts a goal and marks acknowledged", async () => {
    const db = createStateDatabase(":memory:");
    const store = createGoalLifecycleStore(db);

    const goal: AgentGoalWrite = {
      goalId: "g-1",
      kind: "short_term",
      scope: "global",
      status: "accepted",
      origin: "owner_set",
      description: "Test goal",
      completionCriteria: "Done",
      risk: "low",
      priorityHint: 1,
      sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    const result = await store.upsertAgentGoal(goal);
    assert.strictEqual(result.status, "acknowledged");

    const loaded = await store.loadAgentGoal("g-1");
    assert.ok(loaded);
    assert.strictEqual(loaded!.goalId, "g-1");
    assert.strictEqual(loaded!.status, "accepted");
  });

  it("replaces same kind+scope active goal (DR-014 replace semantics)", async () => {
    const db = createStateDatabase(":memory:");
    const store = createGoalLifecycleStore(db);

    const oldGoal: AgentGoalWrite = {
      goalId: "g-old",
      kind: "short_term",
      scope: "global",
      status: "accepted",
      origin: "owner_set",
      description: "Old",
      completionCriteria: "Done",
      risk: "low",
      priorityHint: 1,
      sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    const newGoal: AgentGoalWrite = {
      goalId: "g-new",
      kind: "short_term",
      scope: "global",
      status: "accepted",
      origin: "agent_proposed",
      description: "New",
      completionCriteria: "Done",
      risk: "medium",
      priorityHint: 2,
      sourceRefs: ["ref:2"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertAgentGoal(oldGoal);
    await store.upsertAgentGoal(newGoal);

    const oldLoaded = await store.loadAgentGoal("g-old");
    assert.strictEqual(oldLoaded!.status, "replaced");

    const newLoaded = await store.loadAgentGoal("g-new");
    assert.strictEqual(newLoaded!.status, "accepted");
  });

  it("transitions paused → expired (DR-015)", async () => {
    const db = createStateDatabase(":memory:");
    const store = createGoalLifecycleStore(db);

    const goal: AgentGoalWrite = {
      goalId: "g-1",
      kind: "short_term",
      scope: "global",
      status: "paused",
      origin: "owner_set",
      description: "Paused goal",
      completionCriteria: "Done",
      risk: "low",
      priorityHint: 1,
      sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertAgentGoal(goal);
    const result = await store.transitionGoalLifecycle({
      goalId: "g-1",
      newStatus: "expired",
      updatedAt: "2026-05-21T01:00:00Z",
    });

    assert.strictEqual(result.status, "acknowledged");
    const loaded = await store.loadAgentGoal("g-1");
    assert.strictEqual(loaded!.status, "expired");
  });

  it("rejects invalid transition", async () => {
    const db = createStateDatabase(":memory:");
    const store = createGoalLifecycleStore(db);

    const goal: AgentGoalWrite = {
      goalId: "g-1",
      kind: "short_term",
      scope: "global",
      status: "completed",
      origin: "owner_set",
      description: "Done",
      completionCriteria: "Done",
      risk: "low",
      priorityHint: 1,
      sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertAgentGoal(goal);
    const result = await store.transitionGoalLifecycle({
      goalId: "g-1",
      newStatus: "accepted",
      updatedAt: "2026-05-21T01:00:00Z",
    });

    assert.strictEqual(result.status, "degraded");
  });

  it("lists active goals", async () => {
    const db = createStateDatabase(":memory:");
    const store = createGoalLifecycleStore(db);

    const g1: AgentGoalWrite = {
      goalId: "g-1", kind: "short_term", scope: "global", status: "accepted",
      origin: "owner_set", description: "A", completionCriteria: "Done",
      risk: "low", priorityHint: 1, sourceRefs: ["ref:1"],
      createdAt: "2026-05-21T00:00:00Z", updatedAt: "2026-05-21T00:00:00Z",
    };
    const g2: AgentGoalWrite = {
      goalId: "g-2", kind: "long_term", scope: "global", status: "accepted",
      origin: "owner_set", description: "B", completionCriteria: "Done",
      risk: "low", priorityHint: 2, sourceRefs: ["ref:2"],
      createdAt: "2026-05-21T00:00:00Z", updatedAt: "2026-05-21T00:00:00Z",
    };

    await store.upsertAgentGoal(g1);
    await store.upsertAgentGoal(g2);

    const active = await store.listActiveGoals();
    assert.strictEqual(active.length, 2);
  });
});
