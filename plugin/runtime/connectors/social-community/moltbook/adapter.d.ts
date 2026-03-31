import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";
export interface MoltbookApiClient {
    readFeed(payload: Record<string, unknown>): Promise<unknown>;
    publishPost(payload: Record<string, unknown>): Promise<unknown>;
    replyComment(payload: Record<string, unknown>): Promise<unknown>;
}
export interface MoltbookSkillRunner {
    run(intent: string, payload: Record<string, unknown>): Promise<unknown>;
}
export declare function createMoltbookRunner(input: {
    apiClient: MoltbookApiClient;
    skillRunner: MoltbookSkillRunner;
}): {
    run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
};
