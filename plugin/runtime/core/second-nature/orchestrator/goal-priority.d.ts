/**
 * T2.1.4 — Goal-Directed Intent Priority.
 *
 * `applyGoalPriority` adjusts candidate intent priorities based on accepted AgentGoals.
 * Priority order: user_task > accepted_goal > rhythm.
 * Only goals with status === "accepted" are considered.
 * Agent-proposed goals are included ONLY if policy-accepted (acceptedBy === "policy_allowlist").
 * All other statuses (proposal / rejected / completed / paused) are implicitly excluded.
 */
import type { CandidateIntent } from "../types.js";
import type { AgentGoal } from "../../../storage/goal/agent-goal-store.js";
export interface ApplyGoalPriorityResult {
    candidates: CandidateIntent[];
    goalInfluences: Array<{
        candidateId: string;
        goalIds: string[];
        boost: number;
    }>;
}
export declare function applyGoalPriority(candidates: CandidateIntent[], goals: AgentGoal[] | undefined): ApplyGoalPriorityResult;
