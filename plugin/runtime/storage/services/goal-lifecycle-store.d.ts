/**
 * GoalLifecycleStore — T-SMS.C.3
 *
 * Core logic: Upsert agent goals with BEGIN EXCLUSIVE transaction semantics.
 * Same kind+scope replace: old goal marked "replaced", new goal becomes active.
 * Paused goals support full outgoing edges (completed/expired/replaced/accepted).
 * DR-014: kind is snake_case lowercase enforced at type level.
 * DR-015: paused has complete outgoing transitions.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `agentGoal` schema from `../db/schema/agent-goal.js`
 * - `AgentGoal`, `AgentGoalWrite`, `AgentGoalStatusTransition` from `../../shared/types/goal.js`
 * - `WriteValidationGate` from `./write-validation-gate.js`
 *
 * Boundary:
 * - All writes go through WriteValidationGate.
 * - Upsert uses raw SQL BEGIN EXCLUSIVE for serializability.
 * - transitionGoalLifecycle is called by control-plane, executed by state-memory.
 *
 * Test coverage: tests/unit/storage/goal-lifecycle-store.test.ts
 *   tests/integration/state/goal-lifecycle.test.ts
 */
import type { StateDatabase } from "../db/index.js";
import type { AgentGoal, AgentGoalWrite, AgentGoalStatusTransition } from "../../shared/types/goal.js";
export interface GoalLifecycleStore {
    upsertAgentGoal(goal: AgentGoalWrite): Promise<{
        goalId: string;
        status: "acknowledged" | "degraded";
    }>;
    transitionGoalLifecycle(input: AgentGoalStatusTransition): Promise<{
        goalId: string;
        status: "acknowledged" | "degraded";
    }>;
    listActiveGoals(query?: {
        kind?: string;
        scope?: string;
        limit?: number;
    }): Promise<AgentGoal[]>;
    loadAgentGoal(goalId: string): Promise<AgentGoal | null>;
}
export declare function createGoalLifecycleStore(database: StateDatabase): GoalLifecycleStore;
