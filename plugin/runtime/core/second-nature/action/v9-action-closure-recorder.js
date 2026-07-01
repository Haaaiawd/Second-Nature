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
import { eq, desc } from "drizzle-orm";
import { actionClosureRecord, } from "../../../storage/db/schema/v8-entities.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function makeDegraded(reason, sourceRefs, detail) {
    return {
        status: classifyDegradedStatus(reason),
        reason: reason,
        ownerStage: "closure",
        sourceRefs: sourceRefs,
        operatorNextAction: detail ?? "Retry closure write after DB recovery",
        retryable: true,
    };
}
function serializeSourceRefs(refs) {
    return JSON.stringify(refs);
}
function parseSourceRefs(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed))
            return parsed;
        return [];
    }
    catch {
        return [];
    }
}
function inferDecisionFromReason(reason) {
    if (reason === "policy_allowed" || reason === "closure_completed")
        return "allow";
    if (reason === "policy_deferred_owner_confirmation")
        return "defer";
    if (reason === "policy_downgraded_to_draft")
        return "downgrade";
    return "deny";
}
function mapRowToV9Closure(row) {
    const payload = safeParsePayload(row.payloadJson);
    return {
        id: row.id,
        cycleSequence: typeof payload.cycleSequence === "number" ? payload.cycleSequence : 0,
        intentId: row.proposalId ?? undefined,
        actionKind: row.status ?? "no_action",
        decision: inferDecisionFromReason(row.reason ?? ""),
        platformId: row.platformId ?? undefined,
        capabilityId: row.capabilityId ?? undefined,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        proofRefs: parseSourceRefs(row.proofRefsJson),
        traceRefs: parseSourceRefs(row.traceRefsJson),
        closureRefs: [], // v8 table has no dedicated closureRefs column
        payloadJson: row.payloadJson ?? undefined,
        reasonCode: (row.reason ?? "closure_no_action"),
        routineInvocationId: row.routineId ?? payload.routineInvocationId,
        routineVersion: payload.routineVersion,
        activityThreadId: row.activityThreadId ?? undefined,
        activityStepId: row.activityStepId ?? undefined,
        createdAt: row.createdAt,
    };
}
function safeParsePayload(json) {
    if (!json)
        return {};
    try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return parsed;
        return {};
    }
    catch {
        return {};
    }
}
// ───────────────────────────────────────────────────────────────
// Public API — Read
// ───────────────────────────────────────────────────────────────
export async function readV9ActionClosuresByCycle(db, cycleId) {
    try {
        const rows = await db.db
            .select()
            .from(actionClosureRecord)
            .where(eq(actionClosureRecord.cycleId, cycleId))
            .orderBy(desc(actionClosureRecord.createdAt));
        return { rows: rows.map(mapRowToV9Closure) };
    }
    catch (err) {
        return {
            rows: [],
            degraded: makeDegraded("state_unreadable", [], `Failed to read closures for cycle ${cycleId}: ${err instanceof Error ? err.message : String(err)}`),
        };
    }
}
// ───────────────────────────────────────────────────────────────
// Public API — Write
// ───────────────────────────────────────────────────────────────
export async function recordV9ActionClosure(db, request) {
    const now = request.createdAt ?? new Date().toISOString();
    if (request.sourceRefs.length === 0) {
        return makeDegraded("ledger_missing_source_refs", [], "v9 closure requires at least one source ref");
    }
    // Exactly-one invariant: skip if any closure already exists for this cycle.
    const existing = await readV9ActionClosuresByCycle(db, request.cycleId);
    if (existing.degraded) {
        return existing.degraded;
    }
    if (existing.rows.length > 0) {
        return { id: existing.rows[0].id, idempotent: true };
    }
    const payload = {
        ...request.payload,
        cycleSequence: request.cycleSequence,
        routineVersion: request.routineVersion,
    };
    try {
        await db.db.insert(actionClosureRecord).values({
            id: request.closureId,
            createdAt: now,
            cycleId: request.cycleId,
            platformId: request.platformId,
            capabilityId: request.capabilityId,
            proposalId: request.intentId,
            status: request.actionKind,
            reason: request.reasonCode,
            nextState: "await_next_cycle",
            sourceRefsJson: serializeSourceRefs(request.sourceRefs),
            proofRefsJson: serializeSourceRefs(request.proofRefs ?? []),
            traceRefsJson: serializeSourceRefs(request.traceRefs ?? []),
            redactionClass: "none",
            payloadJson: JSON.stringify(payload),
            routineId: request.routineInvocationId,
            activityThreadId: request.activityThreadId,
            activityStepId: request.activityStepId,
        });
        return { id: request.closureId };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("UNIQUE constraint failed") && message.includes("cycle_id")) {
            // Race loser: another writer inserted a closure for this cycle first.
            // Re-read to return the canonical id, best-effort.
            const existing = await readV9ActionClosuresByCycle(db, request.cycleId);
            return { id: existing.rows[0]?.id ?? request.closureId, idempotent: true };
        }
        return makeDegraded("state_unreadable", request.sourceRefs, `Closure write failed: ${message}`);
    }
}
export async function recordV9NoActionClosure(db, cycleId, cycleSequence, reasonCode, options = {}) {
    const closureId = `cls_v9_no_${cycleId}`;
    return recordV9ActionClosure(db, {
        cycleId,
        cycleSequence,
        closureId,
        actionKind: "no_action",
        decision: "deny",
        reasonCode,
        sourceRefs: options.traceRefs ?? [],
        traceRefs: options.traceRefs ?? [],
        payload: { noAction: true },
        activityThreadId: options.activityThreadId,
        activityStepId: options.activityStepId,
        createdAt: options.now,
    });
}
export async function recordV9PolicyOutcomeClosure(db, cycleId, cycleSequence, actionKind, decision, reasonCode, params, options = {}) {
    const closureId = `cls_v9_${actionKind}_${cycleId}`;
    return recordV9ActionClosure(db, {
        cycleId,
        cycleSequence,
        closureId,
        actionKind,
        decision,
        reasonCode,
        intentId: params.intentId,
        platformId: params.platformId,
        capabilityId: params.capabilityId,
        sourceRefs: params.sourceRefs ?? [],
        proofRefs: params.proofRefs,
        traceRefs: params.traceRefs,
        payload: { cycleSequence, ...params.payload },
        activityThreadId: options.activityThreadId,
        activityStepId: options.activityStepId,
        routineInvocationId: options.routineInvocationId,
        routineVersion: options.routineVersion,
        createdAt: options.now,
    });
}
