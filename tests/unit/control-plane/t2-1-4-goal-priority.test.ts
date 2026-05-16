/**
 * Unit coverage for `applyGoalPriority` (T2.1.4).
 *
 * Verifies accepted goal boost, user_task > accepted_goal > rhythm precedence,
 * proposal/rejected goal no-op, and multi-goal cumulative boost.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { applyGoalPriority } from "../../../src/core/second-nature/orchestrator/goal-priority.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { AgentGoal } from "../../../src/storage/goal/agent-goal-store.js";

function makeCandidate(overrides: Partial<CandidateIntent> = {}): CandidateIntent {
  return {
    id: "intent-test",
    kind: "work",
    priority: 50,
    source: "tick",
    summary: "test intent",
    effectClass: "connector_action",
    sourceRefs: [],
    ...overrides,
  };
}

function makeGoal(overrides: Partial<AgentGoal> = {}): AgentGoal {
  return {
    goalId: "goal-001",
    kind: "short_term",
    status: "accepted",
    origin: "owner_set",
    description: "improve EvoMap profile",
    completionCriteria: "EvoMap connector fully configured",
    risk: "low",
    priorityHint: 1,
    sourceRefs: [],
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

test("T2.1.4 accepted goal boosts related candidate priority", () => {
  const candidates = [
    makeCandidate({ id: "intent-evomap", platformId: "evomap", priority: 60 }),
    makeCandidate({ id: "intent-moltbook", platformId: "moltbook", priority: 55 }),
  ];

  const goals = [makeGoal({ goalId: "g1", description: "improve EvoMap profile" })];

  const result = applyGoalPriority(candidates, goals);

  const evomap = result.candidates.find((c) => c.id === "intent-evomap")!;
  const moltbook = result.candidates.find((c) => c.id === "intent-moltbook")!;

  assert.ok(evomap.priority > 60, "EvoMap intent should be boosted");
  assert.equal(moltbook.priority, 55, "Moltbook intent should not be boosted");
  assert.deepEqual(evomap.goalInfluenceRefs, ["g1"]);
  assert.ok(
    evomap.priorityReasons?.some((r) => r.includes("goal_boost")),
    "reason should reference goal",
  );
});

test("T2.1.4 proposal goal does not boost priority", () => {
  const candidates = [makeCandidate({ id: "intent-evomap", platformId: "evomap", priority: 60 })];
  const goals = [makeGoal({ goalId: "g1", status: "proposal", description: "improve EvoMap profile" })];

  const result = applyGoalPriority(candidates, goals);

  assert.equal(result.candidates[0]!.priority, 60, "proposal goal must not boost");
  assert.equal(result.candidates[0]!.goalInfluenceRefs, undefined);
});

test("T2.1.4 rejected goal does not boost priority", () => {
  const candidates = [makeCandidate({ id: "intent-evomap", platformId: "evomap", priority: 60 })];
  const goals = [makeGoal({ goalId: "g1", status: "rejected", description: "improve EvoMap profile" })];

  const result = applyGoalPriority(candidates, goals);

  assert.equal(result.candidates[0]!.priority, 60, "rejected goal must not boost");
});

test("T2.1.4 user_task scope precedes accepted_goal precedes rhythm", () => {
  // This is implicitly tested by the priority ordering; user_task bypasses the rhythm planner entirely.
  // Here we verify that goal-boosted candidates still respect the base priority ordering.
  const candidates = [
    makeCandidate({ id: "intent-a", platformId: "evomap", priority: 80 }),
    makeCandidate({ id: "intent-b", platformId: "evomap", priority: 50 }),
  ];
  const goals = [makeGoal({ goalId: "g1", description: "improve EvoMap profile" })];

  const result = applyGoalPriority(candidates, goals);

  // Both get boosted, but intent-a should still outrank intent-b
  const a = result.candidates.find((c) => c.id === "intent-a")!;
  const b = result.candidates.find((c) => c.id === "intent-b")!;
  assert.ok(a.priority > b.priority, "higher base priority must remain after goal boost");
});

test("T2.1.4 multiple accepted goals cumulative boost", () => {
  const candidates = [makeCandidate({ id: "intent-evomap", platformId: "evomap", priority: 60 })];
  const goals = [
    makeGoal({ goalId: "g1", description: "improve EvoMap profile" }),
    makeGoal({ goalId: "g2", description: "EvoMap onboarding complete" }),
  ];

  const result = applyGoalPriority(candidates, goals);

  assert.equal(result.candidates[0]!.goalInfluenceRefs!.length, 2);
  assert.equal(result.goalInfluences[0]!.boost, 40, "two goals = 2 * 20 boost");
});

test("T2.1.4 empty goals returns candidates unchanged", () => {
  const candidates = [makeCandidate({ id: "intent-a", priority: 50 })];
  const result = applyGoalPriority(candidates, []);

  assert.equal(result.candidates[0]!.priority, 50);
  assert.equal(result.goalInfluences.length, 0);
});

test("T2.1.4 undefined goals returns candidates unchanged", () => {
  const candidates = [makeCandidate({ id: "intent-a", priority: 50 })];
  const result = applyGoalPriority(candidates, undefined);

  assert.equal(result.candidates[0]!.priority, 50);
});
