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
import { recordNoActionClosure, recordPolicyOutcomeClosure, recordExecutionClosure, } from "../action/action-closure-recorder.js";
import { readActionClosuresByCycle, readLoopStageEventsByCycle, } from "../../../storage/v8-state-stores.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
// Terminal closure statuses — a cycle with any of these is considered finalized.
const TERMINAL_CLOSURE_STATUSES = new Set([
    "completed",
    "no_action",
    "denied",
    "deferred",
    "downgraded",
    "failed",
]);
/**
 * Check whether a cycle already has a terminal closure row.
 * This is the idempotency gate for `finalizeCycle`.
 */
async function checkExistingTerminalClosure(db, cycleId) {
    const existing = await readActionClosuresByCycle(db, cycleId);
    if (existing.degraded)
        return { hasTerminal: false };
    const terminal = existing.rows.find((r) => TERMINAL_CLOSURE_STATUSES.has(r.status));
    if (terminal)
        return { hasTerminal: true, existingClosureId: terminal.id };
    return { hasTerminal: false };
}
export async function finalizeCycle(db, cycleId, closure, options) {
    const now = options?.now ?? new Date().toISOString();
    // Idempotency gate: check if this cycle already has a terminal closure.
    // recordNoActionClosure has its own idempotency check, but policy/execution do not.
    // We check uniformly here to enforce the exactly-one invariant.
    if (closure.kind !== "no_action") {
        const existing = await checkExistingTerminalClosure(db, cycleId);
        if (existing.hasTerminal) {
            return {
                degraded: {
                    status: "unsafe",
                    reason: "closure_idempotency_conflict",
                    ownerStage: "closure",
                    sourceRefs: [],
                    operatorNextAction: `Cycle ${cycleId} already has terminal closure ${existing.existingClosureId}; duplicate finalize blocked`,
                    retryable: false,
                },
            };
        }
    }
    switch (closure.kind) {
        case "no_action": {
            const result = await recordNoActionClosure(db, cycleId, closure.reason, { now });
            if ("closureId" in result) {
                return {
                    closureRef: {
                        uri: `sn://closure/${result.closureId}`,
                        family: "action_closure",
                        id: result.closureId,
                        redactionClass: "none",
                        resolveStatus: "resolvable",
                    },
                    noActionReason: closure.reason,
                };
            }
            return {
                noActionReason: closure.reason,
                degraded: result,
            };
        }
        case "policy": {
            const result = await recordPolicyOutcomeClosure(db, cycleId, closure.closureStatus, closure.reason, {
                proposalId: closure.proposalId,
                decisionId: closure.decisionId,
                platformId: closure.platformId,
                capabilityId: closure.capabilityId,
                downgradedActionKind: closure.downgradedActionKind,
            }, { now });
            if ("closureId" in result) {
                return {
                    closureRef: {
                        uri: `sn://closure/${result.closureId}`,
                        family: "action_closure",
                        id: result.closureId,
                        redactionClass: "none",
                        resolveStatus: "resolvable",
                    },
                };
            }
            return { degraded: result };
        }
        case "execution": {
            const result = await recordExecutionClosure(db, cycleId, closure.closureStatus, closure.reason, {
                proposalId: closure.proposalId,
                decisionId: closure.decisionId,
                platformId: closure.platformId,
                capabilityId: closure.capabilityId,
                executionResultRef: closure.executionResultRef,
                outputSummary: closure.outputSummary,
            }, { now });
            if ("closureId" in result) {
                return {
                    closureRef: {
                        uri: `sn://closure/${result.closureId}`,
                        family: "action_closure",
                        id: result.closureId,
                        redactionClass: "none",
                        resolveStatus: "resolvable",
                    },
                };
            }
            return { degraded: result };
        }
        default: {
            const exhaustive = closure;
            return {
                degraded: {
                    status: classifyDegradedStatus("closure_failed"),
                    reason: "closure_failed",
                    ownerStage: "closure",
                    sourceRefs: [],
                    operatorNextAction: `Unknown closure kind: ${JSON.stringify(exhaustive)}`,
                    retryable: false,
                },
            };
        }
    }
}
/**
 * Reconcile a cycle's closure and stage event rows.
 * Called at cycle start or by `loop_status` to detect partial-failure leftovers.
 *
 * Per design §6.1a:
 * - closure row written, event missing → replay event with traceRefs
 * - event written, closure row missing → report closure_unavailable / unsafe
 */
export async function reconcileCycleClosure(db, cycleId) {
    const closures = await readActionClosuresByCycle(db, cycleId);
    if (closures.degraded) {
        return {
            consistent: false,
            degraded: closures.degraded,
        };
    }
    const events = await readLoopStageEventsByCycle(db, cycleId);
    if (events.degraded) {
        return {
            consistent: false,
            degraded: events.degraded,
        };
    }
    const terminalClosure = closures.rows.find((r) => TERMINAL_CLOSURE_STATUSES.has(r.status));
    const closureEvent = events.rows.find((r) => r.stage === "closure" || r.stage === "action_closure");
    if (terminalClosure && !closureEvent) {
        return {
            orphanedClosure: { closureId: terminalClosure.id, cycleId },
            consistent: false,
        };
    }
    if (!terminalClosure && closureEvent) {
        return {
            orphanedEvent: { cycleId, stage: closureEvent.stage },
            consistent: false,
        };
    }
    return { consistent: true };
}
