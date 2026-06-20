/**
 * CycleFinalizer — v8 exactly-one closure invariant (T-AC.R.2)
 *
 * Core logic: provide a single boundary that records exactly one
 * ActionClosureRecord or no-action closure per heartbeat cycle.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 * - `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md §3.4`
 *
 * Dependencies:
 * - `src/core/second-nature/action/action-closure-recorder.js`
 * - `src/storage/v8-state-stores.js`
 *
 * Boundary:
 * - One cycle → one closure row.
 * - On partial failure, returns degraded diagnostic; caller records stage event.
 * - Does not emit multiple closures for the same cycle.
 *
 * Test coverage: tests/unit/control-plane/cycle-finalizer.test.ts
 */
import { recordNoActionClosure, recordPolicyOutcomeClosure, recordExecutionClosure, } from "../action/action-closure-recorder.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
export async function finalizeCycle(db, cycleId, closure, options) {
    const now = options?.now ?? new Date().toISOString();
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
