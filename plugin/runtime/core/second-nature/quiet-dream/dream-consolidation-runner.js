/**
 * DreamConsolidationRunner — Generate memory candidates from Quiet review.
 *
 * Core logic: Read DreamConsolidationRun and associated QuietDailyReview,
 * apply rules-only candidate generation, redaction gate, validation,
 * and update run status to completed/failed/blocked.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md §4.2`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readDreamConsolidationRunById, readQuietDailyReviewById, writeLongTermMemoryProjection)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Rules-only candidate generation; no model assist in this version.
 * - Does not accept/reject projections; only creates candidates.
 * - Redaction gate blocks sensitive private content, preserves public technical.
 *
 * Test coverage: tests/unit/dream/dream-consolidation-runner.test.ts
 */
import { readDreamConsolidationRunById, readQuietDailyReviewById, } from "../../../storage/v8-state-stores.js";
import { acceptMemoryProjection } from "./memory-projection-lifecycle.js";
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
function buildSourceRefsFromReview(review) {
    return [
        {
            uri: `sn://quiet/${review.id}`,
            family: "quiet_review",
            id: review.id,
            redactionClass: "none",
            resolveStatus: "resolvable",
        },
    ];
}
function redactSensitive(input) {
    // Simple redaction: block credential-shaped patterns
    if (/\b(?:Bearer|token|secret|password|key)\s*[:=]\s*[a-zA-Z0-9+/=]{8,}\b/i.test(input)) {
        return { text: "[redacted: credential shape detected]", blocked: true };
    }
    return { text: input, blocked: false };
}
function generateCandidatesFromReview(runId, reviewId, reviewPayload) {
    const candidates = [];
    const summary = String(reviewPayload.reviewSummary ?? "");
    if (summary.length > 0) {
        const { text, blocked } = redactSensitive(summary);
        if (blocked) {
            candidates.push({
                id: `cand_${runId}_summary`,
                runId,
                reviewId,
                candidateText: text,
                sourceRefs: buildSourceRefsFromReview({ id: reviewId, day: "" }),
                confidence: 0.3,
                validationStatus: "blocked",
                validationReason: "redaction_blocked",
            });
        }
        else {
            candidates.push({
                id: `cand_${runId}_summary`,
                runId,
                reviewId,
                candidateText: `Daily review: ${text}`,
                sourceRefs: buildSourceRefsFromReview({ id: reviewId, day: "" }),
                confidence: 0.6,
                validationStatus: "valid",
            });
        }
    }
    const importanceSignals = reviewPayload.importanceSignals;
    if (importanceSignals && importanceSignals.length > 0) {
        const { text, blocked } = redactSensitive(importanceSignals.join("; "));
        if (!blocked) {
            candidates.push({
                id: `cand_${runId}_signals`,
                runId,
                reviewId,
                candidateText: `Important signals: ${text}`,
                sourceRefs: buildSourceRefsFromReview({ id: reviewId, day: "" }),
                confidence: 0.5,
                validationStatus: "valid",
            });
        }
    }
    return candidates;
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function runDreamConsolidation(db, runId, options) {
    const now = options?.now ?? new Date().toISOString();
    const runRead = await readDreamConsolidationRunById(db, runId);
    if (runRead.degraded) {
        return runRead.degraded;
    }
    const run = runRead.row;
    if (!run) {
        return {
            status: "degraded",
            reason: "state_unreadable",
            ownerStage: "dream",
            sourceRefs: [],
            operatorNextAction: `DreamConsolidationRun ${runId} not found`,
            retryable: false,
        };
    }
    const reviewRead = await readQuietDailyReviewById(db, run.quietReviewId);
    if (reviewRead.degraded) {
        return reviewRead.degraded;
    }
    const review = reviewRead.row;
    if (!review) {
        return {
            status: "degraded",
            reason: "state_unreadable",
            ownerStage: "dream",
            sourceRefs: [],
            operatorNextAction: `QuietDailyReview ${run.quietReviewId} not found`,
            retryable: false,
        };
    }
    const reviewPayload = parsePayloadJson(review.payloadJson);
    const candidates = generateCandidatesFromReview(runId, run.quietReviewId, reviewPayload);
    // If all candidates blocked → run blocked
    if (candidates.length > 0 && candidates.every((c) => c.validationStatus === "blocked")) {
        return {
            runId,
            status: "blocked",
            candidates,
            reason: "dream_blocked_redaction",
        };
    }
    // Accept valid candidates as active long-term memory projections.
    // This completes the Dream→memory lifecycle so accepted projections can be
    // loaded by EmbodiedContext in subsequent heartbeats (T-DQ.R.3 followup).
    const validCandidates = candidates.filter((c) => c.validationStatus === "valid");
    for (const candidate of validCandidates) {
        const acceptResult = await acceptMemoryProjection(db, candidate.id, `topic_${review.day}`, candidate.candidateText, candidate.sourceRefs, { now });
        if ("projectionId" in acceptResult) {
            candidate.acceptedProjectionId = acceptResult.projectionId;
        }
        else {
            return {
                runId,
                status: "failed",
                candidates,
                reason: acceptResult.reason,
            };
        }
    }
    return {
        runId,
        status: "completed",
        candidates,
        reason: "dream_completed",
    };
}
