import type { StateDatabase } from "../../storage/db/index.js";
export interface GoalCommandInput {
    action: "set" | "list" | "accept" | "reject";
    goalId?: string;
    description?: string;
    completionCriteria?: string;
    risk?: "low" | "medium" | "high";
    kind?: "short_term" | "long_term";
    statusFilter?: string;
    originFilter?: string;
    limit?: number;
}
export interface GoalCommandResult {
    ok: boolean;
    command: "goal";
    action: string;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        requiredUserInput?: string[];
        nextStep?: string;
    };
    [key: string]: unknown;
}
export declare function goalCommand(stateDb: StateDatabase | undefined, input: GoalCommandInput): Promise<GoalCommandResult>;
