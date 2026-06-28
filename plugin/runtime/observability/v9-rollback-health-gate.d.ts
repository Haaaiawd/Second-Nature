/**
 * v9 Rollback Liveness Watchdog (T8.2.2).
 *
 * Monitors ConnectorEvolutionPlan rollback state. When a plan remains in
 * gating/blocked status past time/heartbeat thresholds with no rollback
 * success/failure event, infers `rollback_failed` and emits an inferred
 * stage event so the next aggregateLoopHealth sees it.
 *
 * Core logic (§3.7):
 * 1. List stage events since plan.createdAt
 * 2. Filter rollback events matching plan.id
 * 3. If success event → healthy
 * 4. If failure event → blocked (explicit)
 * 5. If plan is gating/blocked AND (elapsed > MAX_WAIT_MS OR heartbeat count > MAX_HEARTBEATS) →
 *    emit inferred rollback_failed stage event → blocked (inferred)
 * 6. Otherwise → degraded (pending)
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §1.7 §3.7 §5.4`
 * - DR-05 rollback liveness gap closure
 * - ADR-004
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (ConnectorEvolutionPlan, RollbackHealth, SourceRef)
 *
 * Boundary:
 * - Watchdog is a pure evaluator given injected events + clock.
 * - Inferred event emission is delegated to a callback (emitInferredEvent)
 *   so the caller controls DB/audit store access.
 * - Does NOT modify the plan; only reads plan.status and emits stage events.
 *
 * Test coverage: `tests/unit/observability/v9-rollback-watchdog.test.ts`
 */
import type { ConnectorEvolutionPlan, RollbackHealth } from "../shared/types/v9-contracts.js";
export declare const ROLLBACK_WATCHDOG: {
    readonly MAX_WAIT_MS: 30000;
    readonly MAX_HEARTBEATS_WITHOUT_EVENT: 5;
    readonly INFERENCE_REASON_CODE: "rollback_failed";
};
export interface StageEventForWatchdog {
    stageKind: string;
    status: string;
    reasonCode: string;
    traceRefsJson?: string;
    observedAt: string;
}
export interface InferredRollbackEvent {
    id: string;
    cycleId: string;
    cycleSequence: number;
    stageKind: "rollback";
    status: "blocked";
    reasonCode: string;
    sourceRefsJson: string;
    proofRefsJson: string;
    traceRefsJson: string;
    payloadJson: string;
    observedAt: string;
    redacted: number;
}
export interface RollbackHealthGateDeps {
    /** List stage events in time window. */
    listStageEvents: (start: string, end: string) => Promise<StageEventForWatchdog[]>;
    /** Emit inferred rollback_failed stage event. */
    emitInferredEvent: (event: InferredRollbackEvent) => Promise<void>;
    /** Current time provider (injectable for testing). */
    now: () => Date;
    /** ID generator (injectable for testing). */
    generateId: () => string;
}
/**
 * Evaluate rollback liveness for a ConnectorEvolutionPlan.
 *
 * Returns RollbackHealth:
 * - healthy: rollback success event found
 * - blocked (explicit): rollback failure event found
 * - blocked (inferred): plan gating/blocked past thresholds, no rollback event
 * - degraded: plan gating/blocked within thresholds, no rollback event yet
 */
export declare function rollbackHealthGate(deps: RollbackHealthGateDeps, plan: ConnectorEvolutionPlan): Promise<RollbackHealth>;
export interface WatchdogBatchResult {
    results: {
        planId: string;
        health: RollbackHealth;
    }[];
    /** Plans that were inferred as rollback_failed. */
    inferredFailures: string[];
}
/**
 * Evaluate rollback liveness for multiple plans in batch.
 * Useful for periodic watchdog sweeps.
 */
export declare function rollbackHealthGateBatch(deps: RollbackHealthGateDeps, plans: ConnectorEvolutionPlan[]): Promise<WatchdogBatchResult>;
/**
 * Check if a plan is in a state that requires watchdog monitoring.
 * Only gating/blocked plans need rollback liveness checks.
 */
export declare function needsWatchdogMonitoring(plan: ConnectorEvolutionPlan): boolean;
