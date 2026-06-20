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
 * - `src/storage/v8-state-stores.js` (readDreamConsolidationRunById, readQuietDailyReviewById)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 *
 * Boundary:
 * - Rules-only candidate generation; no model assist in this version.
 * - Does not accept/reject projections; only creates candidates.
 * - Redaction gate blocks sensitive private content, preserves public technical.
 * - T-DQ.R.10: Does NOT call acceptMemoryProjection. Candidate acceptance is a
 *   separate step owned by the caller (dream-scheduler or explicit accept API).
 *   The runner only generates and validates candidates; it returns them for
 *   the caller to accept via `acceptMemoryProjection(candidateId)`.
 *
 * Test coverage: tests/unit/dream/dream-consolidation-runner.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readDreamConsolidationRunById,
  readQuietDailyReviewById,
} from "../../../storage/v8-state-stores.js";
import type {
  SourceRef,
  DegradedOperationResult,
  V8ReasonCode,
} from "../../../shared/types/v8-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface DreamMemoryCandidate {
  id: string;
  runId: string;
  reviewId: string;
  candidateText: string;
  sourceRefs: SourceRef[];
  confidence: number;
  validationStatus: "valid" | "rejected" | "blocked";
  validationReason?: string;
  acceptedProjectionId?: string;
}

export interface RunDreamConsolidationResult {
  runId: string;
  status: "completed" | "failed" | "blocked";
  candidates: DreamMemoryCandidate[];
  reason?: V8ReasonCode;
}

export interface RunDreamConsolidationOptions {
  now?: string;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function parsePayloadJson(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSourceRefsFromReview(review: { id: string; day: string }): SourceRef[] {
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

type DreamBlockedReason =
  | "dream_blocked_no_content"
  | "dream_blocked_private_redacted"
  | "dream_blocked_credential"
  | "dream_blocked_validation_failed";

function redactSensitive(input: string): { text: string; blocked: boolean; reason?: DreamBlockedReason } {
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

function generateCandidatesFromReview(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
): DreamMemoryCandidate[] {
  const candidates: DreamMemoryCandidate[] = [];

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
    } else {
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

  const importanceSignals = reviewPayload.importanceSignals as string[] | undefined;
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
    } else {
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

function validateCandidate(candidate: DreamMemoryCandidate): DreamBlockedReason | undefined {
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

export async function runDreamConsolidation(
  db: StateDatabase,
  runId: string,
  options?: RunDreamConsolidationOptions,
): Promise<RunDreamConsolidationResult | DegradedOperationResult> {
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
    const firstReason = candidates[0]?.validationReason as DreamBlockedReason | undefined;
    return {
      runId,
      status: "blocked",
      candidates,
      reason: firstReason ?? "dream_blocked_private_redacted",
    };
  }

  // T-DQ.R.10: Runner only generates and validates candidates.
  // Acceptance is a separate step owned by the caller via acceptMemoryProjection.
  // Valid candidates are returned with validationStatus="valid" for the caller
  // to accept; the runner does NOT call acceptMemoryProjection here.
  return {
    runId,
    status: "completed",
    candidates,
    reason: "dream_completed",
  };
}
