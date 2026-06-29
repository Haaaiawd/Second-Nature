/**
 * ActionClosureRecorder — Record heartbeat cycle closure outcomes.
 *
 * Core logic: Write ActionClosureRecord for no-action, completed, denied,
 * deferred, downgraded, and failed outcomes. Handles idempotent retry
 * and remember-for-review memory candidates.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeActionClosureRecord, readActionClosuresByCycle)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Does not execute actions; only records outcomes.
 * - Does not form long-term memory; only emits review intent.
 * - Degrades gracefully on DB failure.
 *
 * Test coverage: tests/unit/action/action-closure-recorder.test.ts
 */
import { writeActionClosureRecord, readActionClosuresByCycle, } from "../../../storage/v8-state-stores.js";
import { buildClosureProvenance, cycleTraceRef, closureTraceRef, decisionProofRef, } from "../../../shared/provenance-tier.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function buildInputSummary(proposalId, decisionId) {
    const parts = [];
    if (proposalId)
        parts.push(`proposal=${proposalId}`);
    if (decisionId)
        parts.push(`decision=${decisionId}`);
    return parts.join(" ") || "no-action";
}
// ───────────────────────────────────────────────────────────────
// Public API — No action
// ───────────────────────────────────────────────────────────────
export async function recordNoActionClosure(db, cycleId, noActionReason, options) {
    const now = options?.now ?? new Date().toISOString();
    const closureId = `cls_no_${cycleId}`;
    const existing = await readActionClosuresByCycle(db, cycleId);
    if (!existing.degraded && existing.rows.some((r) => r.status === "no_action")) {
        return { status: "idempotent", closureId };
    }
    const result = await writeActionClosureRecord(db, {
        id: closureId,
        createdAt: now,
        cycleId,
        platformId: "heartbeat",
        status: "no_action",
        reason: noActionReason,
        nextState: "await_next_cycle",
        sourceRefs: [cycleTraceRef(cycleId)],
        proofRefs: [
            {
                uri: `sn://closure/no_action/${cycleId}`,
                family: "action_closure",
                id: cycleId,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
        ],
        traceRefs: [cycleTraceRef(cycleId)],
        redactionClass: "none",
        payload: { dispatchAttempt: 0, inputSummary: "no-action" },
    });
    if ("reason" in result) {
        return result;
    }
    return { status: "recorded", closureId };
}
// ───────────────────────────────────────────────────────────────
// Public API — Remember for review
// ───────────────────────────────────────────────────────────────
export async function recordRememberClosure(db, cycleId, memoryReviewCandidate, options) {
    const now = options?.now ?? new Date().toISOString();
    const closureId = `cls_remember_${cycleId}_${now.replace(/[:.]/g, "")}`;
    const provenance = buildClosureProvenance({
        sourceRefs: memoryReviewCandidate.sourceRefs,
        traceRefs: [cycleTraceRef(cycleId)],
    });
    const result = await writeActionClosureRecord(db, {
        id: closureId,
        createdAt: now,
        cycleId,
        platformId: options?.platformId ?? "heartbeat",
        capabilityId: options?.capabilityId,
        status: "completed",
        reason: "remember_for_review",
        nextState: "pending_daily_review",
        sourceRefs: provenance.sourceRefs,
        proofRefs: provenance.proofRefs,
        traceRefs: provenance.traceRefs,
        redactionClass: "none",
        payload: {
            memoryReviewCandidate,
            dispatchAttempt: 1,
            inputSummary: `remember_for_review topic=${memoryReviewCandidate.topicKey}`,
        },
    });
    if ("reason" in result) {
        return result;
    }
    return { status: "recorded", closureId };
}
// ───────────────────────────────────────────────────────────────
// Public API — Policy decision outcome
// ───────────────────────────────────────────────────────────────
export async function recordPolicyOutcomeClosure(db, cycleId, closureStatus, reason, params, options) {
    const now = options?.now ?? new Date().toISOString();
    const closureId = `cls_${closureStatus}_${cycleId}_${now.replace(/[:.]/g, "")}`;
    const sourceRefs = params.proposalId
        ? [
            {
                uri: `sn://proposal/${params.proposalId}`,
                family: "action_closure",
                id: params.proposalId,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
        ]
        : [];
    const proofRefs = [
        closureTraceRef(closureId),
        ...(params.decisionId ? [decisionProofRef(params.decisionId)] : []),
    ];
    const result = await writeActionClosureRecord(db, {
        id: closureId,
        createdAt: now,
        cycleId,
        platformId: params.platformId ?? "heartbeat",
        capabilityId: params.capabilityId,
        proposalId: params.proposalId,
        decisionId: params.decisionId,
        status: closureStatus,
        reason,
        nextState: params.nextState ?? "await_next_cycle",
        sourceRefs,
        proofRefs,
        traceRefs: [cycleTraceRef(cycleId)],
        redactionClass: "none",
        payload: {
            dispatchAttempt: 1,
            inputSummary: buildInputSummary(params.proposalId, params.decisionId),
            postProcessing: params.postProcessing ?? [],
            downgradedActionKind: params.downgradedActionKind,
        },
    });
    if ("reason" in result) {
        return result;
    }
    return { status: "recorded", closureId };
}
// ───────────────────────────────────────────────────────────────
// Public API — Execution outcome
// ───────────────────────────────────────────────────────────────
export async function recordExecutionClosure(db, cycleId, closureStatus, reason, params, options) {
    const now = options?.now ?? new Date().toISOString();
    const closureId = `cls_exec_${closureStatus}_${cycleId}_${now.replace(/[:.]/g, "")}`;
    const sourceRefs = params.executionResultRef
        ? [
            {
                uri: params.executionResultRef,
                family: "connector_result",
                id: params.executionResultRef,
                redactionClass: "none",
                resolveStatus: "resolvable",
            },
        ]
        : [];
    const proofRefs = [
        closureTraceRef(closureId),
    ];
    const result = await writeActionClosureRecord(db, {
        id: closureId,
        createdAt: now,
        cycleId,
        platformId: params.platformId ?? "heartbeat",
        capabilityId: params.capabilityId,
        proposalId: params.proposalId,
        decisionId: params.decisionId,
        status: closureStatus,
        reason,
        nextState: params.nextState ?? (closureStatus === "completed" ? "await_next_cycle" : "retryable"),
        sourceRefs,
        proofRefs,
        traceRefs: [cycleTraceRef(cycleId)],
        redactionClass: "none",
        payload: {
            dispatchAttempt: 1,
            executionResultRef: params.executionResultRef,
            outputSummary: params.outputSummary,
            inputSummary: buildInputSummary(params.proposalId, params.decisionId),
            retryable: params.retryable ?? closureStatus === "failed",
        },
    });
    if ("reason" in result) {
        return result;
    }
    return { status: "recorded", closureId };
}
