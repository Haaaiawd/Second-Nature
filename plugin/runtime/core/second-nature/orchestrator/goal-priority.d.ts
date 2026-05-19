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
/**
 * Minimal goal context used by the priority module to avoid coupling
 * to the full AgentGoal schema. M-03 decoupling.
 */
export interface GoalPriorityContext {
    goalId: string;
    description: string;
    completionCriteria?: string;
    status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
    origin: "owner_set" | "agent_proposed" | "policy_seeded";
    acceptedBy?: "owner" | "policy_allowlist";
}
export declare function isGoalRelatedToCandidate(goal: GoalPriorityContext, candidate: CandidateIntent): boolean;
export interface ApplyGoalPriorityResult {
    candidates: CandidateIntent[];
    goalInfluences: Array<{
        candidateId: string;
        goalIds: string[];
        boost: number;
    }>;
}
export declare function applyGoalPriority(candidates: CandidateIntent[], goals: GoalPriorityContext[] | undefined): ApplyGoalPriorityResult;
