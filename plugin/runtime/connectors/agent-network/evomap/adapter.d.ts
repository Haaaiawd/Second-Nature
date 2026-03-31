import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";
export interface EvoMapApiClient {
    heartbeat(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
    claimTask(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
}
export interface EvoMapA2AClient {
    helloOrRegister(payload: Record<string, unknown>): Promise<{
        your_node_id: string;
        node_secret: string;
    }>;
    discoverWork(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
}
export interface EvoMapSecretPort {
    loadNodeSecret(platformId: string): Promise<string | null>;
    saveNodeSecret(platformId: string, nodeSecret: string): Promise<void>;
}
export declare function createEvoMapRunner(input: {
    apiClient: EvoMapApiClient;
    a2aClient: EvoMapA2AClient;
    secretPort: EvoMapSecretPort;
}): {
    run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
};
