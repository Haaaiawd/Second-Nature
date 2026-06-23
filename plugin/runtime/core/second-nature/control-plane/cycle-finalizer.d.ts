/**
 * CycleFinalizer — v8 exactly-one closure invariant (T-AC.R.2, T-AC.R.3)
 *
 * Core logic: provide a single boundary that records exactly one
 * ActionClosureRecord or no-action closure per heartbeat cycle.
 * Enforces idempotency key = cycleId, write order (closure row first),
 * and restart reconcile for orphaned closure/event rows.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §6.1a`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §3.4`
 *
 * Dependencies:
 * - `src/core/second-nature/action/action-closure-recorder.js`
 * - `src/storage/v8-state-stores.js`
 *
 * Boundary:
 * - One cycle → one closure row.
 * - Duplicate terminal closure for same cycleId → `unsafe` idempotency conflict.
 * - On partial failure, returns degraded diagnostic; caller records stage event.
 * - Reconcile detects orphaned closure (event missing) or orphaned event (closure missing).
 *
 * Test coverage: tests/unit/control-plane/cycle-finalizer.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { DegradedOperationResult, V8ReasonCode, SourceRef } from "../../../shared/types/v8-contracts.js";
export interface CycleFinalizerResult {
    closureRef?: SourceRef;
    noActionReason?: V8ReasonCode;
    degraded?: DegradedOperationResult;
}
export type ClosureKind = {
    kind: "no_action";
    reason: V8ReasonCode;
} | {
    kind: "policy";
    closureStatus: "completed" | "denied" | "deferred" | "downgraded";
    reason: V8ReasonCode;
    proposalId: string;
    decisionId: string;
    platformId?: string;
    capabilityId?: string;
    downgradedActionKind?: string;
} | {
    kind: "execution";
    closureStatus: "completed" | "failed";
    reason: V8ReasonCode;
    proposalId: string;
    decisionId: string;
    platformId?: string;
    capabilityId?: string;
    executionResultRef?: string;
    outputSummary?: string;
};
export declare function finalizeCycle(db: StateDatabase, cycleId: string, closure: ClosureKind, options?: {
    now?: string;
}): Promise<CycleFinalizerResult>;
export interface ReconcileResult {
    /** Closure row exists but no closure stage event — event should be replayed. */
    orphanedClosure?: {
        closureId: string;
        cycleId: string;
    };
    /** Stage event exists but no closure row — closure is missing, do not fabricate. */
    orphanedEvent?: {
        cycleId: string;
        stage: string;
    };
    /** No orphan detected — cycle is consistent. */
    consistent: boolean;
    degraded?: DegradedOperationResult;
}
/**
 * Reconcile a cycle's closure and stage event rows.
 * Called at cycle start or by `loop_status` to detect partial-failure leftovers.
 *
 * Per design §6.1a:
 * - closure row written, event missing → replay event with traceRefs
 * - event written, closure row missing → report closure_unavailable / unsafe
 */
export declare function reconcileCycleClosure(db: StateDatabase, cycleId: string): Promise<ReconcileResult>;
