/**
 * GoalLifecyclePolicy — T-CP.C.3
 *
 * Core logic: Evaluates active goals, detects replace/expire/complete
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

export function createGoalLifecyclePolicy(): GoalLifecyclePolicy {
  return {
    evaluate(goals) {
      const now = new Date().toISOString();
      const activeGoals: AgentGoal[] = [];
      const transitionRequests: GoalTransitionRequest[] = [];

      // Group by kind+scope to detect duplicates among accepted goals
      const groups = new Map<string, AgentGoal[]>();
      for (const goal of goals) {
        if (goal.status !== "accepted") continue;
        const key = `${goal.kind}:${goal.scope ?? "global"}`;
        const list = groups.get(key) ?? [];
        list.push(goal);
        groups.set(key, list);
      }

      for (const [key, list] of groups) {
        // Sort by updatedAt desc, keep newest as active
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime(),
        );
        const [newest, ...older] = sorted;

        if (newest) {
          activeGoals.push(newest);

          // Older same kind+scope goals → replace
          for (const old of older) {
            transitionRequests.push({
              goalId: old.goalId,
              newStatus: "replaced",
              reason: `same_kind_scope_replace:${key}`,
              updatedAt: now,
            });
          }
        }
      }

      // Detect expired goals among active
      for (const goal of activeGoals) {
        if (goal.expiresAt && new Date(goal.expiresAt) < new Date(now)) {
          transitionRequests.push({
            goalId: goal.goalId,
            newStatus: "expired",
            reason: "expires_at_reached",
            updatedAt: now,
          });
        }
      }

      return {
        activeGoals,
        transitionRequests,
        evaluatedAt: now,
      };
    },
  };
}
