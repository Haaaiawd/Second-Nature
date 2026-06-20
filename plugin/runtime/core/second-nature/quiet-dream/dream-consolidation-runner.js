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
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
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
    // Credential-shaped patterns first — highest sensitivity.
    if (/\b(?:Bearer|token|secret|password|key)\s*[:=]\s*[a-zA-Z0-9+/=]{8,}\b/i.test(input)) {
        return { text: "[redacted: credential shape detected]", blocked: true, reason: "dream_blocked_credential" };
    }
    // Private context markers (names, addresses, phone numbers) — lower threshold than credential.
    if (/\b(?:ssn|social.security|phone|address|email)\s*[:=]\s*[^\s]+/i.test(input)) {
        return { text: "[redacted: private context]", blocked: true, reason: "dream_blocked_private_redacted" };
    }
    return { text: input, blocked: false };
}
function generateCandidatesFromReview(runId, reviewId, reviewPayload) {
    const candidates = [];
    const summary = String(reviewPayload.reviewSummary ?? "");
    if (summary.length > 0) {
        const { text, blocked, reason } = redactSensitive(summary);
        if (blocked) {
            candidates.push({
                id: `cand_${runId}_summary`,
                runId,
                reviewId,
                candidateText: text,
                sourceRefs: buildSourceRefsFromReview({ id: reviewId, day: "" }),
                confidence: 0.3,
                validationStatus: "blocked",
                validationReason: reason,
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
        const { text, blocked, reason } = redactSensitive(importanceSignals.join("; "));
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
        else {
            candidates.push({
                id: `cand_${runId}_signals`,
                runId,
                reviewId,
                candidateText: text,
                sourceRefs: buildSourceRefsFromReview({ id: reviewId, day: "" }),
                confidence: 0.3,
                validationStatus: "blocked",
                validationReason: reason,
            });
        }
    }
    return candidates;
}
function validateCandidate(candidate) {
    if (!candidate.candidateText || candidate.candidateText.trim().length === 0) {
        return "dream_blocked_validation_failed";
    }
    if (!candidate.sourceRefs || candidate.sourceRefs.length === 0) {
        return "dream_blocked_validation_failed";
    }
    if (candidate.confidence < 0.1) {
        return "dream_blocked_validation_failed";
    }
    return undefined;
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
            status: classifyDegradedStatus("state_unreadable"),
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
            status: classifyDegradedStatus("state_unreadable"),
            reason: "state_unreadable",
            ownerStage: "dream",
            sourceRefs: [],
            operatorNextAction: `QuietDailyReview ${run.quietReviewId} not found`,
            retryable: false,
        };
    }
    const reviewPayload = parsePayloadJson(review.payloadJson);
    const contentStatus = String(reviewPayload.contentStatus ?? "");
    // Block placeholder or empty Quiet reviews before candidate generation.
    if (contentStatus === "placeholder_rejected" || contentStatus === "content_missing" || contentStatus === "empty") {
        return {
            runId,
            status: "blocked",
            candidates: [],
            reason: "dream_blocked_no_content",
        };
    }
    const candidates = generateCandidatesFromReview(runId, run.quietReviewId, reviewPayload);
    // Run candidate validation; invalid candidates block the run with a precise reason.
    for (const candidate of candidates) {
        if (candidate.validationStatus === "valid") {
            const validationReason = validateCandidate(candidate);
            if (validationReason) {
                candidate.validationStatus = "blocked";
                candidate.validationReason = validationReason;
            }
        }
    }
    // If all candidates blocked → run blocked with the first precise reason.
    if (candidates.length > 0 && candidates.every((c) => c.validationStatus === "blocked")) {
        const firstReason = candidates[0]?.validationReason;
        return {
            runId,
            status: "blocked",
            candidates,
            reason: firstReason ?? "dream_blocked_private_redacted",
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
