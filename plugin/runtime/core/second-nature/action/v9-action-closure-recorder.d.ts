/**
 * v9 ActionClosureRecorder — Record v9 heartbeat cycle closure outcomes.
 *
 * Core logic: Write ActionClosureRecord rows with v9 source-ref shape,
 * routine/activity linkage, and exactly-one terminal closure invariant.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4-§3.6`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §9`
 * - ADR-002: Attention is not Agent mind
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/storage/db/schema/v8-entities.js` (action_closure_record table)
 * - `src/shared/types/v9-contracts.js` (v9 SourceRef, ActionClosureRecord)
 *
 * Boundary:
 * - Does not execute actions; only records outcomes.
 * - Preserves v9 SourceRef shape in JSON columns.
 * - Enforces exactly one terminal closure per cycle via idempotency check.
 *
 * Test coverage: `tests/unit/action/v9-action-closure-recorder.test.ts`
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { ActionClosureActionKind, ActionClosureDecision, SourceRef, V9ReasonCode, DegradedOperationResult, ActionClosureRecord } from "../../../shared/types/v9-contracts.js";
export interface V9ClosureRecordRequest {
    cycleId: string;
    cycleSequence: number;
    closureId: string;
    actionKind: ActionClosureActionKind;
    decision: ActionClosureDecision;
    reasonCode: V9ReasonCode;
    platformId?: string;
    capabilityId?: string;
    intentId?: string;
    sourceRefs: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
    closureRefs?: SourceRef[];
    payload?: Record<string, unknown>;
    activityThreadId?: string;
    activityStepId?: string;
    routineInvocationId?: string;
    routineVersion?: string;
    createdAt?: string;
}
export interface V9ClosureRecordResult {
    id: string;
    idempotent?: boolean;
}
export declare function readV9ActionClosuresByCycle(db: StateDatabase, cycleId: string): Promise<{
    rows: ActionClosureRecord[];
    degraded?: DegradedOperationResult;
}>;
export declare function recordV9ActionClosure(db: StateDatabase, request: V9ClosureRecordRequest): Promise<V9ClosureRecordResult | DegradedOperationResult>;
export interface V9NoActionClosureOptions {
    now?: string;
    traceRefs?: SourceRef[];
    activityThreadId?: string;
    activityStepId?: string;
}
export declare function recordV9NoActionClosure(db: StateDatabase, cycleId: string, cycleSequence: number, reasonCode: V9ReasonCode, options?: V9NoActionClosureOptions): Promise<V9ClosureRecordResult | DegradedOperationResult>;
export interface V9PolicyOutcomeClosureOptions {
    now?: string;
    activityThreadId?: string;
    activityStepId?: string;
    routineInvocationId?: string;
    routineVersion?: string;
}
export declare function recordV9PolicyOutcomeClosure(db: StateDatabase, cycleId: string, cycleSequence: number, actionKind: ActionClosureActionKind, decision: ActionClosureDecision, reasonCode: V9ReasonCode, params: {
    intentId?: string;
    platformId?: string;
    capabilityId?: string;
    sourceRefs?: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
    payload?: Record<string, unknown>;
}, options?: V9PolicyOutcomeClosureOptions): Promise<V9ClosureRecordResult | DegradedOperationResult>;
