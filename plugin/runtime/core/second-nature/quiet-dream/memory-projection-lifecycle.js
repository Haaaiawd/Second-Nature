/**
 * MemoryProjectionLifecycle — Manage accepted long-term memory projections.
 *
 * Core logic: Accept, activate, supersede, and reject projections.
 * When accepting a projection on a topic with existing active projection,
 * supersede the old one.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readMemoryProjectionsByTopic, writeLongTermMemoryProjection)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Only accepts projections with source refs.
 * - Supersedes old active projections on same topic automatically.
 * - Does not delete projections; only transitions status.
 *
 * Test coverage: tests/unit/dream/memory-projection-lifecycle.test.ts
 */
import { readMemoryProjectionsByTopic, writeLongTermMemoryProjection, updateLongTermMemoryProjectionStatus, } from "../../../storage/v8-state-stores.js";
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function acceptMemoryProjection(db, candidateId, topicKey, memoryText, sourceRefs, options) {
    const now = options?.now ?? new Date().toISOString();
    if (sourceRefs.length === 0) {
        return {
            status: "degraded",
            reason: "source_refs_unresolved",
            ownerStage: "projection",
            sourceRefs: [],
            operatorNextAction: "Acceptance requires source refs",
            retryable: false,
        };
    }
    const existing = await readMemoryProjectionsByTopic(db, topicKey);
    if (existing.degraded) {
        return existing.degraded;
    }
    // Find active projection to supersede
    const activeProjection = existing.rows.find((r) => r.status === "active" || r.status === "accepted");
    let supersedesId;
    if (activeProjection) {
        // Supersede existing active projection — UPDATE instead of INSERT
        const supersedeResult = await updateLongTermMemoryProjectionStatus(db, activeProjection.id, "superseded", JSON.stringify({
            ...parsePayloadJson(activeProjection.payloadJson),
            supersededAt: now,
            supersededBy: candidateId,
        }));
        if ("reason" in supersedeResult) {
            return supersedeResult;
        }
        supersedesId = activeProjection.id;
    }
    // Create new accepted/active projection
    const projectionId = `proj_${candidateId}_${now.replace(/[:.]/g, "")}`;
    const writeResult = await writeLongTermMemoryProjection(db, {
        id: projectionId,
        createdAt: now,
        candidateId,
        topicKey,
        status: "active",
        sourceRefs,
        redactionClass: "none",
        payloadJson: JSON.stringify({
            memoryText,
            acceptedAt: now,
            supersedesProjectionId: supersedesId,
        }),
    });
    if ("reason" in writeResult) {
        return writeResult;
    }
    return {
        projectionId,
        status: "accepted",
        reason: "projection_accepted",
        supersedesProjectionId: supersedesId,
    };
}
export async function rejectMemoryProjection(db, projectionId, _candidateId, _topicKey, _sourceRefs, reason = "projection_rejected", options) {
    const now = options?.now ?? new Date().toISOString();
    // F5: Use UPDATE instead of INSERT to avoid PK conflict on existing projections
    const updateResult = await updateLongTermMemoryProjectionStatus(db, projectionId, "rejected", JSON.stringify({ rejectedAt: now, reason }));
    if ("reason" in updateResult) {
        return updateResult;
    }
    return {
        projectionId,
        status: "rejected",
        reason,
    };
}
export async function retireMemoryProjection(db, projectionId, _candidateId, _topicKey, _sourceRefs, options) {
    const now = options?.now ?? new Date().toISOString();
    // F5: Use UPDATE instead of INSERT to avoid PK conflict on existing projections
    const updateResult = await updateLongTermMemoryProjectionStatus(db, projectionId, "retired", JSON.stringify({ retiredAt: now }));
    if ("reason" in updateResult) {
        return updateResult;
    }
    return {
        projectionId,
        status: "retired",
        reason: "projection_rejected",
    };
}
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function parsePayloadJson(json) {
    if (!json)
        return {};
    try {
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
