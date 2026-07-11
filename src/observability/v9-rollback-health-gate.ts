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

import type {
  ConnectorEvolutionPlan,
  RollbackHealth,
  SourceRef,
} from "../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Watchdog constants (§1.7)
// ───────────────────────────────────────────────────────────────

export const ROLLBACK_WATCHDOG = {
  MAX_WAIT_MS: 30_000,
  MAX_HEARTBEATS_WITHOUT_EVENT: 5,
  INFERENCE_REASON_CODE: "rollback_failed",
} as const;

// ───────────────────────────────────────────────────────────────
// Input types
// ───────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────
// rollbackHealthGate (§3.7)
// ───────────────────────────────────────────────────────────────

/**
 * Evaluate rollback liveness for a ConnectorEvolutionPlan.
 *
 * Returns RollbackHealth:
 * - healthy: rollback success event found
 * - blocked (explicit): rollback failure event found
 * - blocked (inferred): plan gating/blocked past thresholds, no rollback event
 * - degraded: plan gating/blocked within thresholds, no rollback event yet
 */
export async function rollbackHealthGate(
  deps: RollbackHealthGateDeps,
  plan: ConnectorEvolutionPlan,
): Promise<RollbackHealth> {
  const now = deps.now();
  const events = await deps.listStageEvents(plan.createdAt, now.toISOString());

  // Filter rollback events matching this plan.id
  const rollbackEvents = events.filter(
    (e) => e.stageKind === "rollback" && (e.traceRefsJson ?? "").includes(plan.id),
  );

  // Check for explicit success
  const success = rollbackEvents.some(
    (e) => e.status === "ok" && e.reasonCode === "rollback_succeeded",
  );
  if (success) {
    return { status: "healthy", rollbackBlocked: false };
  }

  // Check for explicit failure
  const failure = rollbackEvents.some(
    (e) => e.status === "blocked" || e.reasonCode === "evolution_rollback_failed",
  );
  if (failure) {
    return {
      status: "blocked",
      rollbackBlocked: true,
      reason: "evolution_rollback_failed",
    };
  }

  // Missing rollback event inference
  const elapsedMs = now.getTime() - new Date(plan.createdAt).getTime();
  const heartbeatCount = events.filter((e) => e.stageKind === "closure").length;

  // Plan is in a state that expects rollback — gating or blocked.
  // Note: §3.7 pseudocode uses 'rolling_back' but ConnectorEvolutionStatus
  // contract has 'gating' | 'blocked' | 'rolled_back' | 'activated' | 'proposed'.
  // We adapt: gating and blocked are the states that watchdog monitors.
  const expectsRollback = plan.status === "gating" || plan.status === "blocked";

  if (
    expectsRollback &&
    (elapsedMs > ROLLBACK_WATCHDOG.MAX_WAIT_MS ||
      heartbeatCount > ROLLBACK_WATCHDOG.MAX_HEARTBEATS_WITHOUT_EVENT)
  ) {
    // Emit inferred rollback_failed stage event
    const inferredEvent: InferredRollbackEvent = {
      id: deps.generateId(),
      cycleId: "watchdog",
      cycleSequence: 0,
      stageKind: "rollback",
      status: "blocked",
      reasonCode: ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE,
      sourceRefsJson: JSON.stringify(plan.sourceRefs),
      proofRefsJson: "[]",
      traceRefsJson: JSON.stringify([{ family: "connector", id: plan.id }]),
      payloadJson: JSON.stringify({ planId: plan.id, inferred: true }),
      observedAt: now.toISOString(),
      redacted: 0,
    };
    await deps.emitInferredEvent(inferredEvent);

    return {
      status: "blocked",
      rollbackBlocked: true,
      reason: ROLLBACK_WATCHDOG.INFERENCE_REASON_CODE,
      inferred: true,
    };
  }

  // Pending — within thresholds, no rollback event yet
  return {
    status: "degraded",
    rollbackBlocked: false,
    reason: "rollback_pending",
  };
}

// ───────────────────────────────────────────────────────────────
// Batch watchdog evaluation
// ───────────────────────────────────────────────────────────────

export interface WatchdogBatchResult {
  results: { planId: string; health: RollbackHealth }[];
  /** Plans that were inferred as rollback_failed. */
  inferredFailures: string[];
}

/**
 * Evaluate rollback liveness for multiple plans in batch.
 * Useful for periodic watchdog sweeps.
 */
export async function rollbackHealthGateBatch(
  deps: RollbackHealthGateDeps,
  plans: ConnectorEvolutionPlan[],
): Promise<WatchdogBatchResult> {
  const results: { planId: string; health: RollbackHealth }[] = [];
  const inferredFailures: string[] = [];

  for (const plan of plans) {
    const health = await rollbackHealthGate(deps, plan);
    results.push({ planId: plan.id, health });
    if (health.inferred) {
      inferredFailures.push(plan.id);
    }
  }

  return { results, inferredFailures };
}

// ───────────────────────────────────────────────────────────────
// Helper: check if plan needs watchdog monitoring
// ───────────────────────────────────────────────────────────────

/**
 * Check if a plan is in a state that requires watchdog monitoring.
 * Only gating/blocked plans need rollback liveness checks.
 */
export function needsWatchdogMonitoring(plan: ConnectorEvolutionPlan): boolean {
  return plan.status === "gating" || plan.status === "blocked";
}
