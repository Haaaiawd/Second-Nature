import type { StateDatabase } from "../db/index.js";
export interface SourceRef {
    sourceId: string;
    kind: string;
    url?: string;
    snippet?: string;
}
export interface AgentGoal {
    goalId: string;
    kind: "short_term" | "long_term";
    status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
    origin: "owner_set" | "agent_proposed" | "policy_seeded";
    description: string;
    completionCriteria: string;
    risk: "low" | "medium" | "high";
    priorityHint: number;
    sourceRefs: SourceRef[];
    acceptedBy?: "owner" | "policy_allowlist";
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}
export interface AgentGoalWrite {
    goalId: string;
    kind: "short_term" | "long_term";
    status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
    origin: "owner_set" | "agent_proposed" | "policy_seeded";
    description: string;
    completionCriteria: string;
    risk: "low" | "medium" | "high";
    priorityHint: number;
    sourceRefs: SourceRef[];
    acceptedBy?: "owner" | "policy_allowlist";
    createdAt: string;
    updatedAt: string;
}
export interface AgentGoalStatusTransition {
    goalId: string;
    newStatus: "proposal" | "accepted" | "rejected" | "completed" | "paused";
    acceptedBy?: "owner" | "policy_allowlist";
    updatedAt: string;
}
export interface AgentGoalQuery {
    statuses?: AgentGoal["status"][];
    origins?: AgentGoal["origin"][];
    limit?: number;
}
export interface AgentGoalWriteAck {
    goalId: string;
    status: "acknowledged" | "degraded";
}
export interface AgentGoalStore {
    upsertAgentGoal(goal: AgentGoalWrite): Promise<AgentGoalWriteAck>;
    listAgentGoals(query: AgentGoalQuery): Promise<AgentGoal[]>;
    transitionGoalStatus(input: AgentGoalStatusTransition): Promise<AgentGoalWriteAck>;
    loadAgentGoal(goalId: string): Promise<AgentGoal | null>;
}
export declare function createAgentGoalStore(database: StateDatabase): AgentGoalStore;
