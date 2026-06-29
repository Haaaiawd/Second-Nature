/**
 * ProceduralProjectionLifecycle — Manage accepted procedural projection candidates.
 *
 * Core logic: Accept, reject, or retire capability-pattern routines that emerge
 * from Quiet/Dream consolidation. Accepting a candidate on a capability pattern
 * that already has an active projection supersedes the old one.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3`
 *
 * Dependencies:
 * - `src/storage/v9-state-stores.js` (readProceduralProjectionsByCapabilityPattern,
 *   writeProceduralProjection, updateProceduralProjectionStatus)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Only accepts candidates with source refs and a capability pattern.
 * - Supersedes old active projections on the same capability pattern automatically.
 * - Does not delete projections; only transitions status.
 *
 * Test coverage: tests/unit/dream/v9-procedural-projection-lifecycle.test.ts
 */
import { readProceduralProjectionsByCapabilityPattern, writeProceduralProjection, updateProceduralProjectionStatus, } from "../../../storage/v9-state-stores.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
import { randomUUID } from "node:crypto";
function generateProjectionId(candidateId) {
    return `proc_${candidateId}_${randomUUID()}`;
}
function toV8SourceRefs(refs) {
    return refs;
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function acceptProceduralProjection(db, candidateId, capabilityPattern, routineText, sourceRefs, options) {
    const now = options?.now ?? new Date().toISOString();
    if (sourceRefs.length === 0) {
        return {
            status: classifyDegradedStatus("source_refs_unresolved"),
            reason: "source_refs_unresolved",
            ownerStage: "projection",
            sourceRefs: [],
            operatorNextAction: "Procedural acceptance requires source refs",
            retryable: false,
        };
    }
    if (!capabilityPattern || capabilityPattern.trim().length === 0) {
        return {
            status: classifyDegradedStatus("quiet_validation_failed"),
            reason: "quiet_validation_failed",
            ownerStage: "projection",
            sourceRefs: toV8SourceRefs(sourceRefs),
            operatorNextAction: "Procedural acceptance requires capabilityPattern",
            retryable: false,
        };
    }
    const existing = await readProceduralProjectionsByCapabilityPattern(db, capabilityPattern);
    if (existing.degraded) {
        return existing.degraded;
    }
    let supersedesProjectionId;
    for (const old of existing.rows) {
        if (old.status === "installed") {
            const updated = await updateProceduralProjectionStatus(db, old.id, "rejected");
            if (updated?.status !== "rejected") {
                return {
                    status: classifyDegradedStatus("state_unreadable"),
                    reason: "state_unreadable",
                    ownerStage: "projection",
                    sourceRefs: toV8SourceRefs(sourceRefs),
                    operatorNextAction: `Failed to supersede projection ${old.id}`,
                    retryable: true,
                };
            }
            supersedesProjectionId = old.id;
        }
    }
    const projectionId = generateProjectionId(candidateId);
    const written = await writeProceduralProjection(db, {
        id: projectionId,
        createdAt: now,
        candidateId,
        capabilityPattern,
        status: "installed",
        sourceRefs,
        payloadJson: options?.payloadJson,
    });
    if (!written) {
        return {
            status: classifyDegradedStatus("state_unreadable"),
            reason: "state_unreadable",
            ownerStage: "projection",
            sourceRefs: toV8SourceRefs(sourceRefs),
            operatorNextAction: "Failed to write procedural projection",
            retryable: true,
        };
    }
    return {
        projectionId,
        status: supersedesProjectionId ? "accepted" : "accepted",
        reason: "routine_validation_pending",
        supersedesProjectionId,
    };
}
export async function rejectProceduralProjection(db, projectionId) {
    const updated = await updateProceduralProjectionStatus(db, projectionId, "rejected");
    if (!updated) {
        return {
            status: classifyDegradedStatus("state_unreadable"),
            reason: "state_unreadable",
            ownerStage: "projection",
            sourceRefs: [],
            operatorNextAction: `Failed to reject procedural projection ${projectionId}`,
            retryable: true,
        };
    }
    return {
        projectionId,
        status: "rejected",
        reason: "routine_invocation_denied",
    };
}
export async function retireProceduralProjection(db, projectionId) {
    const updated = await updateProceduralProjectionStatus(db, projectionId, "retired");
    if (!updated) {
        return {
            status: classifyDegradedStatus("state_unreadable"),
            reason: "state_unreadable",
            ownerStage: "projection",
            sourceRefs: [],
            operatorNextAction: `Failed to retire procedural projection ${projectionId}`,
            retryable: true,
        };
    }
    return {
        projectionId,
        status: "retired",
        reason: "continuity_stale_projections",
    };
}
