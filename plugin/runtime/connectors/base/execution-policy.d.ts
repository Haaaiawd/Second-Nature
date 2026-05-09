import type { CapabilityIntent, ConnectorRequest, ExecutionPlan } from "./contract.js";
export type EffectSemanticsClass = "read_only" | "side_effect" | "task_claim" | "keepalive";
export declare function classifyConnectorIntentEffect(intent: CapabilityIntent): EffectSemanticsClass;
export interface EffectCommitLedgerPort {
    getOrCreateIntentCommitRecord(input: {
        decisionId: string;
        intentId: string;
        idempotencyKey: string;
        effectClass: string;
    }): Promise<{
        existing: boolean;
        record: {
            id: string;
            state: string;
            outcomeRef?: string;
        };
    }>;
}
/** In-memory ledger for tests and offline harnesses. */
export declare class InMemoryEffectCommitLedger implements EffectCommitLedgerPort {
    private readonly byKey;
    private key;
    getOrCreateIntentCommitRecord(input: {
        decisionId: string;
        intentId: string;
        idempotencyKey: string;
        effectClass: string;
    }): Promise<{
        existing: boolean;
        record: {
            id: string;
            state: string;
            outcomeRef?: string;
        };
    }>;
    /** Test seam: mark a key as already committed with replayable outcome. */
    seedCommitted(decisionId: string, idempotencyKey: string, outcomeRef: string): void;
    markState(decisionId: string, idempotencyKey: string, state: string): void;
}
export interface EnforceExecutionPolicyDeps {
    effectCommitLedger?: EffectCommitLedgerPort;
}
export declare function enforceExecutionPolicy(plan: ExecutionPlan, intent: CapabilityIntent, request: ConnectorRequest, deps: EnforceExecutionPolicyDeps): Promise<{
    skipAdapter: boolean;
    existingOutcomeRef?: string;
    effectCommitId?: string;
}>;
