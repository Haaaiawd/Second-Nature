import type { CredentialContext } from "../../../shared/types/credential.js";
import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";
export interface InStreetApiClient {
    listNotifications(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
    sendMessage(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
    replyComment(payload: Record<string, unknown>, apiKey: string): Promise<unknown>;
    heartbeat(apiKey: string): Promise<unknown>;
}
export interface InStreetSkillRunner {
    resumeVerification(ctx: CredentialContext): Promise<{
        apiKey?: string;
        status: "active" | "failed";
    }>;
    run(intent: ExecutionPlan["intent"], payload: Record<string, unknown>, context: {
        credential: CredentialContext;
        apiKey?: string;
    }): Promise<unknown>;
}
export interface InStreetCredentialPort {
    loadCredentialState(platformId: string): Promise<CredentialContext>;
    persistVerificationOutcome(platformId: string, outcome: {
        status: "active" | "failed";
        apiKey?: string;
    }): Promise<void>;
}
export declare function createInStreetRunner(input: {
    apiClient: InStreetApiClient;
    credentialPort: InStreetCredentialPort;
    skillRunner: InStreetSkillRunner;
}): {
    run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
};
