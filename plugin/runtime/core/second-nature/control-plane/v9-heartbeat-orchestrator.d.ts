/**
 * v9 HeartbeatOrchestrator — Attention-to-closure heartbeat cycle.
 *
 * Core logic: Assemble EmbodiedContext, build AttentionSignal, advance
 * ActivityThread, resolve Agent/routine-authored intent, evaluate policy,
 * record exactly-one terminal closure, and trigger daily rhythm.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.1 §5`
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §4.1`
 * - ADR-002: Attention is not Agent mind
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/core/second-nature/control-plane/v9-embodied-context-assembler.js`
 * - `src/core/second-nature/control-plane/activity-thread-coordinator.js`
 * - `src/core/second-nature/action/v9-action-proposal-builder.js`
 * - `src/core/second-nature/action/v9-autonomy-policy-evaluator.js`
 * - `src/core/second-nature/action/v9-action-closure-recorder.js`
 * - `src/storage/db/schema/v8-entities.js` (heartbeat_cycle_trace, loop_stage_event)
 * - `src/storage/v8-state-stores.js` (checkDailyRhythm)
 *
 * Boundary:
 * - Does NOT make semantic action decisions; intent must be authored by Agent or routine.
 * - Does NOT execute real external platform writes.
 * - AttentionSignal is a hint, not a final judgment.
 * - Every cycle produces exactly one terminal closure or explicit degraded reason.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-attention-cycle.test.ts`
 * - `tests/integration/v9/attention-to-closure-chain.test.ts`
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import { type DailyRhythmState } from "../quiet-dream/daily-rhythm-scheduler.js";
import type { ActivityStep, ActivityThread, AttentionSignal, EmbodiedContext, AgentActionIntent, SourceRef, V9ReasonCode, DegradedOperationResult, ActionClosureActionKind, ActionPolicyDecision, ActionProposal } from "../../../shared/types/v9-contracts.js";
import type { V9EmbodiedContextAssembler } from "./v9-embodied-context-assembler.js";
import type { createActivityThreadCoordinator } from "./activity-thread-coordinator.js";
export interface V9HeartbeatOrchestrationRequest {
    workspaceRoot: string;
    requestedAt?: string;
    trigger?: "scheduled" | "manual" | "host";
    runtimeAvailable?: boolean;
}
export interface V9HeartbeatOrchestrationResult {
    cycleId: string;
    cycleSequence: number;
    status: "completed" | "degraded" | "carrier_only";
    closureRef?: SourceRef;
    noActionReason?: V9ReasonCode;
    degraded?: DegradedOperationResult;
    rhythmState?: DailyRhythmState;
    rhythmDegraded?: DegradedOperationResult;
}
export interface AttentionPort {
    buildAttentionSignal(input: {
        cycleId: string;
        cycleSequence: number;
        evidenceItems: Array<{
            id: string;
            sourceRefs?: SourceRef[];
            platformId?: string;
        }>;
        embodiedContext: EmbodiedContext;
    }): Promise<AttentionSignal | DegradedOperationResult>;
}
export interface EvidenceReadPort {
    loadRecentEvidence(options: {
        workspaceRoot: string;
        limit: number;
    }): Promise<Array<{
        id: string;
        sourceRefs?: SourceRef[];
        platformId?: string;
    }>>;
}
export interface AgentActionIntentResolver {
    resolveIntent(input: {
        attention: AttentionSignal;
        activity?: {
            thread: ActivityThread;
            step: ActivityStep;
        };
        context: EmbodiedContext;
        cycleRef: {
            cycleId: string;
            cycleSequence: number;
        };
    }): Promise<AgentActionIntent | null>;
}
export interface ActionClosurePort {
    evaluateAndDispatch(intent: AgentActionIntent, cycleRef: {
        cycleId: string;
        cycleSequence: number;
    }, context: EmbodiedContext): Promise<{
        actionKind: ActionClosureActionKind;
        decision: ActionPolicyDecision["decision"];
        reasonCode: V9ReasonCode;
        proposal?: ActionProposal;
        downgradedActionKind?: string;
    } | null>;
}
export interface V9HeartbeatOrchestratorDeps {
    db: StateDatabase;
    assembler: V9EmbodiedContextAssembler;
    attentionPort: AttentionPort;
    evidenceReadPort?: EvidenceReadPort;
    activityThreadCoordinator: ReturnType<typeof createActivityThreadCoordinator>;
    intentResolver: AgentActionIntentResolver;
    actionClosurePort?: ActionClosurePort;
}
export declare function runV9HeartbeatCycle(db: StateDatabase, request: V9HeartbeatOrchestrationRequest, deps: V9HeartbeatOrchestratorDeps): Promise<V9HeartbeatOrchestrationResult | DegradedOperationResult>;
export interface CreateV9HeartbeatOrchestratorOptions {
    actionClosurePort?: ActionClosurePort;
}
export declare function createV9HeartbeatOrchestrator(db: StateDatabase, deps: Omit<V9HeartbeatOrchestratorDeps, "db" | "actionClosurePort"> & CreateV9HeartbeatOrchestratorOptions): {
    run: (request: V9HeartbeatOrchestrationRequest) => Promise<DegradedOperationResult | V9HeartbeatOrchestrationResult>;
};
