import { type FailureClass } from "./failure-taxonomy.js";
import { type EffectCommitLedgerPort } from "./execution-policy.js";
import type { CapabilityIntent, ConnectorRequest, ConnectorResult, ExecutionPlan, ExecutionRunner, RoutePlanner } from "./contract.js";
import type { ExecutionTelemetry } from "../../observability/services/execution-telemetry.js";
export interface RetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
}
export interface CooldownPort {
    isBlocked(platformId: string, intent: CapabilityIntent): Promise<{
        blocked: boolean;
        retryAfterMs?: number;
    }>;
    markFailure(platformId: string, intent: CapabilityIntent, failureClass: FailureClass, retryAfterMs?: number): Promise<void>;
}
export interface ConnectorPolicyContext {
    routePlanner: RoutePlanner;
    executionRunner: ExecutionRunner;
    telemetry?: ExecutionTelemetry;
    cooldownPort?: CooldownPort;
    retryPolicy?: Partial<RetryPolicy>;
    allowDegradedFallback?: (plan: ExecutionPlan, request: ConnectorRequest) => boolean;
    effectCommitLedger?: EffectCommitLedgerPort;
}
export declare function createConnectorPolicyLayer(ctx: ConnectorPolicyContext): {
    executeWithPolicy(intent: CapabilityIntent, request: ConnectorRequest): Promise<ConnectorResult<unknown>>;
};
