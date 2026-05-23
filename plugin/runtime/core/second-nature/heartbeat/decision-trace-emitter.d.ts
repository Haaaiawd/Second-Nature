/**
 * DecisionTraceEmitter — T-CP.C.2
 *
 * Core logic: Emits machine-readable DecisionTracePayload to observability.
 * Trace persistence belongs to observability-health-system; this module only
 * constructs and forwards the payload.
 *
 * Boundary:
 * - Emission errors are swallowed — trace must not block heartbeat cycle.
 * - No-op emitter available for carrier-only paths and tests.
 *
 * Test coverage: tests/unit/control-plane/decision-trace-emitter.test.ts
 */
export interface DecisionTracePayload {
    traceId: string;
    decisionId: string;
    contextId?: string;
    scope: string;
    status: string;
    reasons: string[];
    selectedIntentId?: string;
    emittedAt: string;
}
export interface DecisionTraceEmitter {
    emit(trace: DecisionTracePayload): Promise<void>;
}
export declare function createDecisionTraceEmitter(port: (payload: DecisionTracePayload) => Promise<void>): DecisionTraceEmitter;
/** No-op emitter for carrier-only or test paths. */
export declare function createNoOpTraceEmitter(): DecisionTraceEmitter;
