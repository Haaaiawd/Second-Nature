import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";
export interface AgentWorldApiClient {
    readFeed(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
    discoverWork(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
    claimTask(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
}
export declare function createAgentWorldRunner(input: {
    apiClient: AgentWorldApiClient;
}): {
    run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
};
