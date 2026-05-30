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

/** Minimal goal shape required by the lifecycle policy evaluator. */
export interface EvaluableGoal {
  goalId: string;
  kind?: string;
  scope?: string;
  status: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface GoalLifecyclePolicyResult {
  activeGoals: EvaluableGoal[];
  transitionRequests: GoalTransitionRequest[];
  evaluatedAt: string;
}

export interface GoalLifecyclePolicy {
  evaluate(goals: EvaluableGoal[]): GoalLifecyclePolicyResult;
}

export function createGoalLifecyclePolicy(): GoalLifecyclePolicy {
  return {
    evaluate(goals) {
      const now = new Date().toISOString();
      const activeGoals: EvaluableGoal[] = [];
      const transitionRequests: GoalTransitionRequest[] = [];

      // Group by kind+scope to detect duplicates among accepted goals
      const groups = new Map<string, EvaluableGoal[]>();
      for (const goal of goals) {
        if (goal.status !== "accepted") continue;
        const key = `${goal.kind}:${goal.scope ?? "global"}`;
        const list = groups.get(key) ?? [];
        list.push(goal);
        groups.set(key, list);
      }

      for (const [key, list] of groups) {
        // Sort by updatedAt desc, keep newest as active
        const sorted = [...list].sort((a, b) => {
          const aTime = new Date(a.updatedAt ?? 0).getTime();
          const bTime = new Date(b.updatedAt ?? 0).getTime();
          if (isNaN(aTime) || isNaN(bTime)) return 0;
          return bTime - aTime;
        });
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
        if (goal.expiresAt) {
          const expiresTime = new Date(goal.expiresAt).getTime();
          if (!isNaN(expiresTime) && expiresTime < new Date(now).getTime()) {
            transitionRequests.push({
              goalId: goal.goalId,
              newStatus: "expired",
              reason: "expires_at_reached",
              updatedAt: now,
            });
          }
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
