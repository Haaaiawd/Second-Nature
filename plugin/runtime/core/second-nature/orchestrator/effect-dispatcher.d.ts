import type { ConnectorResult, CapabilityIntent, ConnectorExecutor } from "../../../connectors/base/contract.js";
export type { ConnectorExecutor } from "../../../connectors/base/contract.js";
import { LeaseManager, type EffectClass } from "./lease-manager.js";
export interface AllowedIntent {
    id: string;
    kind: "work" | "exploration" | "social" | "quiet" | "reflection" | "outreach" | "maintenance";
    summary: string;
    effectClass: EffectClass;
    platformId?: string;
    payload?: Record<string, unknown>;
}
export interface DecisionContext {
    decisionId: string;
    intentId: string;
    tickId: string;
    checkpointId: string;
    traceId: string;
}
export interface IntentCommitPort {
    createIntentCommitRecord(input: {
        intentId: string;
        decisionId: string;
        checkpointId?: string;
        state: "planned" | "dispatched" | "externally_acknowledged" | "committed" | "reconcile" | "aborted";
    }): Promise<{
        id: string;
    }>;
    advanceIntentCommitState(id: string, state: "planned" | "dispatched" | "externally_acknowledged" | "committed" | "reconcile" | "aborted", metadata?: Record<string, unknown>): Promise<void>;
    commitIntentOutcome(id: string, outcome: {
        traceId: string;
        outcomeRef: string;
    }): Promise<void>;
    abortIntentCommit(id: string, reason: string): Promise<void>;
}
export interface CheckpointPort {
    saveCheckpoint(input: {
        id: string;
        tickId: string;
        intentId: string;
        phase: "before_effect" | "before_quiet_write";
        snapshotRef: string;
    }): Promise<void>;
}
export interface MemoryPort {
    persistCurationResult(input: {
        summary: string;
        sourceRefs: string[];
        traceId: string;
    }): Promise<void>;
}
export interface ReflectionPort {
    runNarrativeReflection(input: {
        decisionId: string;
        intentId: string;
        traceId: string;
    }): Promise<{
        outcomeRef: string;
    }>;
}
export type DispatchResult = {
    status: "deferred";
    reason: string;
} | {
    status: "effect_executed";
    result: ConnectorResult<unknown>;
    commitId: string;
} | {
    status: "curated";
    commitId: string;
} | {
    status: "reflected";
    commitId: string;
} | {
    status: "maintenance_done";
    commitId: string;
};
export declare function toCapabilityIntent(intent: Pick<AllowedIntent, "kind">): CapabilityIntent;
export declare class EffectDispatcher {
    private readonly leaseManager;
    private readonly commitPort;
    private readonly connectorExecutor;
    private readonly checkpointPort;
    private readonly memoryPort;
    private readonly reflectionPort;
    constructor(leaseManager: LeaseManager, commitPort: IntentCommitPort, connectorExecutor: ConnectorExecutor, checkpointPort: CheckpointPort, memoryPort: MemoryPort, reflectionPort: ReflectionPort);
    dispatchEffect(intent: AllowedIntent, decision: DecisionContext): Promise<DispatchResult>;
}
export declare function buildDecisionContext(input: {
    tickId: string;
    decisionId?: string;
    intentId: string;
}): DecisionContext;
