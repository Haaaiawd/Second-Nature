import type { ObservabilityDatabase } from "../db/index.js";
import type { ExecutionAttempt, IntentCommitState } from "../../shared/types/continuity.js";
export interface ExecutionAttemptInput {
    traceId: string;
    decisionId: string;
    intentId: string;
    platformId: string;
    capability: string;
    channel: string;
    commitState?: IntentCommitState;
    failureClass?: string;
    retryPolicy?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
    startedAt?: string;
    finishedAt?: string;
}
export declare class ExecutionTelemetry {
    private db;
    constructor(db: ObservabilityDatabase);
    recordExecutionAttempt(attempt: ExecutionAttempt): Promise<void>;
    startAttempt(input: ExecutionAttemptInput): Promise<string>;
    completeAttempt(traceId: string, status: "succeeded" | "failed", commitState?: IntentCommitState, failureClass?: string): Promise<void>;
    updateCommitState(traceId: string, commitState: IntentCommitState): Promise<void>;
    queryByTraceId(traceId: string): Promise<ExecutionAttempt | null>;
    queryByDecisionId(decisionId: string): Promise<ExecutionAttempt[]>;
    queryByPlatform(platformId: string): Promise<ExecutionAttempt[]>;
    queryFailedAttempts(since: string): Promise<ExecutionAttempt[]>;
    queryByCommitState(commitState: IntentCommitState): Promise<ExecutionAttempt[]>;
    private mapToExecutionAttempt;
}
