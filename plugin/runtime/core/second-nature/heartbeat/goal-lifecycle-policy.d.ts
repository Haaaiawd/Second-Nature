/**
 * GoalLifecyclePolicy — T-CP.C.3
 *
 * Core logic: Evaluates active goals, detects replace/expire
 * conditions, and emits typed GoalTransitionRequest.
 *
 * Responsibility separation (DR-012):
 * - control-plane evaluates and emits transition requests.
 * - state-memory executes transitions via GoalLifecycleStore.
 * - This module does NOT write goal state directly.
 *
 * Rules:
 * - Same kind+scope: newest accepted goal stays active; older ones → replaced.
 * - Expired goals (expiresAt < now) → expired transition request.
 *
 * Boundary:
 * - Consumes AgentGoal[] from EmbodiedContext.goals slice.
 * - Returns GoalTransitionRequest[] for state-memory to execute.
 *
 * Test coverage: tests/unit/control-plane/goal-lifecycle-policy.test.ts
 */
import type { AgentGoal } from "../../../shared/types/goal.js";
export interface GoalTransitionRequest {
    goalId: string;
    newStatus: "completed" | "expired" | "replaced" | "paused" | "accepted";
    reason: string;
    updatedAt: string;
}
export interface GoalLifecyclePolicyResult {
    activeGoals: AgentGoal[];
    transitionRequests: GoalTransitionRequest[];
    evaluatedAt: string;
}
export interface GoalLifecyclePolicy {
    evaluate(goals: AgentGoal[]): GoalLifecyclePolicyResult;
}
export declare function createGoalLifecyclePolicy(): GoalLifecyclePolicy;
