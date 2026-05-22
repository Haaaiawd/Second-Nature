import { describe, it } from "node:test";
import assert from "node:assert";
import { createGoalLifecyclePolicy } from "../../../src/core/second-nature/heartbeat/goal-lifecycle-policy.js";
import type { AgentGoal } from "../../../src/shared/types/goal.js";

function makeGoal(overrides: Partial<AgentGoal> = {}): AgentGoal {
  return {
    goalId: "g-1",
    kind: "task_completion",
    scope: "global",
    status: "accepted",
    origin: "owner",
    description: "test goal",
    completionCriteria: "done",
    risk: "low",
    priorityHint: 1,
    sourceRefs: ["ref-1"] as [string, ...string[]],
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
    ...overrides,
  } as AgentGoal;
}

describe("createGoalLifecyclePolicy", () => {
  it("keeps single active goal without transitions", () => {
    const policy = createGoalLifecyclePolicy();
    const goals = [makeGoal()];
    const result = policy.evaluate(goals);
    assert.strictEqual(result.activeGoals.length, 1);
    assert.strictEqual(result.transitionRequests.length, 0);
  });

  it("emits replace request for older same kind+scope goal", () => {
    const policy = createGoalLifecyclePolicy();
    const goals = [
      makeGoal({ goalId: "g-old", updatedAt: "2026-05-01T00:00:00Z" }),
      makeGoal({ goalId: "g-new", updatedAt: "2026-05-02T00:00:00Z" }),
    ];
    const result = policy.evaluate(goals);
    assert.strictEqual(result.activeGoals.length, 1);
    assert.strictEqual(result.activeGoals[0]!.goalId, "g-new");
    assert.strictEqual(result.transitionRequests.length, 1);
    assert.strictEqual(result.transitionRequests[0]!.newStatus, "replaced");
    assert.strictEqual(result.transitionRequests[0]!.goalId, "g-old");
    assert.ok(result.transitionRequests[0]!.reason.includes("same_kind_scope_replace"));
  });

  it("emits expire request for expired goal", () => {
    const policy = createGoalLifecyclePolicy();
    const goals = [
      makeGoal({ expiresAt: "2020-01-01T00:00:00Z" }),
    ];
    const result = policy.evaluate(goals);
    assert.strictEqual(result.transitionRequests.length, 1);
    assert.strictEqual(result.transitionRequests[0]!.newStatus, "expired");
    assert.strictEqual(result.transitionRequests[0]!.reason, "expires_at_reached");
  });

  it("ignores non-accepted goals", () => {
    const policy = createGoalLifecyclePolicy();
    const goals = [
      makeGoal({ status: "completed" as const }),
      makeGoal({ status: "rejected" as const }),
    ];
    const result = policy.evaluate(goals);
    assert.strictEqual(result.activeGoals.length, 0);
    assert.strictEqual(result.transitionRequests.length, 0);
  });

  it("handles multiple kind+scope groups independently", () => {
    const policy = createGoalLifecyclePolicy();
    const goals = [
      makeGoal({ goalId: "g-a1", kind: "short_term", updatedAt: "2026-05-01T00:00:00Z" }),
      makeGoal({ goalId: "g-a2", kind: "short_term", updatedAt: "2026-05-02T00:00:00Z" }),
      makeGoal({ goalId: "g-b1", kind: "passive_sensing", updatedAt: "2026-05-01T00:00:00Z" }),
      makeGoal({ goalId: "g-b2", kind: "passive_sensing", updatedAt: "2026-05-02T00:00:00Z" }),
    ];
    const result = policy.evaluate(goals);
    assert.strictEqual(result.activeGoals.length, 2);
    assert.strictEqual(result.transitionRequests.length, 2);
  });
});
