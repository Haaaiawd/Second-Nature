/**
 * v9 DreamConsolidationRunner — T5.2.1 output family routing.
 *
 * Core logic: Extend v8 dream consolidation to emit candidates across v9
 * output families:
 *   - memory          → long-term memory projection candidates
 *   - procedural      → ToolRoutine / capability-pattern candidates
 *   - self_continuity → SelfContinuityCard refresh signals
 *   - connector_evolution → ConnectorEvolutionPlan candidates
 *   - character       → CharacterFrame refresh hints
 *
 * The runner only generates and validates candidates; it does not accept or
 * install projections/routines/plans. Callers own acceptance via lifecycle
 * ports (acceptMemoryProjection, acceptProceduralProjection, etc.).
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readDreamConsolidationRunById, readQuietDailyReviewById)
 * - `src/storage/v9-state-stores.js` (optional persistence for candidate ids)
 * - `src/shared/types/v8-contracts.js` (SourceRef, DegradedOperationResult, V8ReasonCode)
 * - `src/shared/types/v9-contracts.js` (SourceRef as canonical v9 shape)
 *
 * Boundary:
 * - Rules-only candidate generation; no model assist.
 * - Does not accept/reject projections.
 * - Redaction gate blocks sensitive private content and credential shapes.
 *
 * Test coverage:
 * - tests/unit/dream/v9-dream-output-families.test.ts
 * - tests/integration/v9/quiet-dream-continuity.test.ts
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import {
  readDreamConsolidationRunById,
  readQuietDailyReviewById,
} from "../../../storage/v8-state-stores.js";
import type { SourceRef } from "../../../shared/types/v9-contracts.js";
import type { DegradedOperationResult, V8ReasonCode } from "../../../shared/types/v8-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type DreamOutputFamily =
  | "memory"
  | "procedural"
  | "self_continuity"
  | "connector_evolution"
  | "character";

export interface DreamOutputCandidate {
  id: string;
  runId: string;
  reviewId: string;
  family: DreamOutputFamily;
  candidateText: string;
  sourceRefs: SourceRef[];
  confidence: number;
  validationStatus: "valid" | "rejected" | "blocked";
  validationReason?: string;
  // Family-specific metadata
  topicKey?: string;
  capabilityPattern?: string;
  platformId?: string;
  planType?: string;
}

export interface RunV9DreamConsolidationResult {
  runId: string;
  status: "completed" | "failed" | "blocked";
  candidates: DreamOutputCandidate[];
  reason?: V8ReasonCode;
  outputFamilies: DreamOutputFamily[];
}

export interface RunV9DreamConsolidationOptions {
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
      family: "quiet" as const,
      id: review.id,
      label: `quiet review ${review.day}`,
    },
  ];
}

type DreamBlockedReason =
  | "dream_blocked_no_content"
  | "dream_blocked_private_redacted"
  | "dream_blocked_credential"
  | "dream_blocked_validation_failed";

function redactSensitive(input: string): { text: string; blocked: boolean; reason?: DreamBlockedReason } {
  if (/\b(?:Bearer|token|secret|password|key)\b[^\n]{0,40}[a-zA-Z0-9+/=_-]{8,}/i.test(input)) {
    return { text: "[redacted: credential shape detected]", blocked: true, reason: "dream_blocked_credential" };
  }
  if (/\b(?:ssn|social.security|phone|address|email)\s*[:=]\s*[^\s]+/i.test(input)) {
    return { text: "[redacted: private context]", blocked: true, reason: "dream_blocked_private_redacted" };
  }
  return { text: input, blocked: false };
}

function makeBaseCandidate(
  runId: string,
  reviewId: string,
  family: DreamOutputFamily,
  suffix: string,
  text: string,
  sourceRefs: SourceRef[],
  confidence: number,
): DreamOutputCandidate {
  return {
    id: `cand_${runId}_${family}_${suffix}`,
    runId,
    reviewId,
    family,
    candidateText: text,
    sourceRefs,
    confidence,
    validationStatus: "valid",
  };
}

function generateMemoryCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  const candidates: DreamOutputCandidate[] = [];

  const summary = String(reviewPayload.reviewSummary ?? "");
  if (summary.length > 0) {
    const { text, blocked, reason } = redactSensitive(summary);
    if (blocked) {
      candidates.push({
        ...makeBaseCandidate(runId, reviewId, "memory", "summary", text, baseRefs, 0.3),
        validationStatus: "blocked",
        validationReason: reason,
        topicKey: "daily_review_summary",
      });
    } else {
      candidates.push({
        ...makeBaseCandidate(runId, reviewId, "memory", "summary", `Daily review: ${text}`, baseRefs, 0.6),
        topicKey: "daily_review_summary",
      });
    }
  }

  const importanceSignals = reviewPayload.importanceSignals as string[] | undefined;
  if (importanceSignals && importanceSignals.length > 0) {
    const { text, blocked, reason } = redactSensitive(importanceSignals.join("; "));
    if (blocked) {
      candidates.push({
        ...makeBaseCandidate(runId, reviewId, "memory", "signals", text, baseRefs, 0.3),
        validationStatus: "blocked",
        validationReason: reason,
        topicKey: "important_signals",
      });
    } else {
      candidates.push({
        ...makeBaseCandidate(runId, reviewId, "memory", "signals", `Important signals: ${text}`, baseRefs, 0.5),
        topicKey: "important_signals",
      });
    }
  }

  return candidates;
}

function generateProceduralCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  const candidates: DreamOutputCandidate[] = [];
  const routineSignals = reviewPayload.routineSignals as Array<{ capabilityPattern: string; summary: string }> | undefined;

  if (routineSignals && routineSignals.length > 0) {
    for (let i = 0; i < routineSignals.length; i++) {
      const sig = routineSignals[i];
      if (!sig?.capabilityPattern) continue;
      const { text, blocked, reason } = redactSensitive(sig.summary);
      candidates.push({
        ...makeBaseCandidate(
          runId,
          reviewId,
          "procedural",
          `routine_${i}`,
          blocked ? text : `Routine candidate for ${sig.capabilityPattern}: ${text}`,
          baseRefs,
          blocked ? 0.3 : 0.6,
        ),
        validationStatus: blocked ? "blocked" : "valid",
        validationReason: blocked ? reason : undefined,
        capabilityPattern: sig.capabilityPattern,
      });
    }
  }

  return candidates;
}

function generateSelfContinuityCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  const candidates: DreamOutputCandidate[] = [];
  const continuitySignals = reviewPayload.continuitySignals as string[] | undefined;

  if (continuitySignals && continuitySignals.length > 0) {
    const { text, blocked, reason } = redactSensitive(continuitySignals.join("; "));
    candidates.push({
      ...makeBaseCandidate(
        runId,
        reviewId,
        "self_continuity",
        "refresh",
        blocked ? text : `Continuity refresh: ${text}`,
        baseRefs,
        blocked ? 0.3 : 0.5,
      ),
      validationStatus: blocked ? "blocked" : "valid",
      validationReason: blocked ? reason : undefined,
    });
  }

  return candidates;
}

function generateConnectorEvolutionCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  const candidates: DreamOutputCandidate[] = [];
  const evolutionSignals = reviewPayload.connectorEvolutionSignals as Array<{
    platformId: string;
    planType: string;
    summary: string;
  }> | undefined;

  if (evolutionSignals && evolutionSignals.length > 0) {
    for (let i = 0; i < evolutionSignals.length; i++) {
      const sig = evolutionSignals[i];
      if (!sig?.platformId || !sig?.planType) continue;
      const { text, blocked, reason } = redactSensitive(sig.summary);
      candidates.push({
        ...makeBaseCandidate(
          runId,
          reviewId,
          "connector_evolution",
          `evolution_${i}`,
          blocked ? text : `Connector evolution for ${sig.platformId}: ${text}`,
          baseRefs,
          blocked ? 0.3 : 0.5,
        ),
        validationStatus: blocked ? "blocked" : "valid",
        validationReason: blocked ? reason : undefined,
        platformId: sig.platformId,
        planType: sig.planType,
      });
    }
  }

  return candidates;
}

function generateCharacterCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  const candidates: DreamOutputCandidate[] = [];
  const characterSignals = reviewPayload.characterSignals as string[] | undefined;

  if (characterSignals && characterSignals.length > 0) {
    const { text, blocked, reason } = redactSensitive(characterSignals.join("; "));
    candidates.push({
      ...makeBaseCandidate(
        runId,
        reviewId,
        "character",
        "refresh",
        blocked ? text : `Character refresh: ${text}`,
        baseRefs,
        blocked ? 0.3 : 0.4,
      ),
      validationStatus: blocked ? "blocked" : "valid",
      validationReason: blocked ? reason : undefined,
    });
  }

  return candidates;
}

function generateCandidates(
  runId: string,
  reviewId: string,
  reviewPayload: Record<string, unknown>,
  baseRefs: SourceRef[],
): DreamOutputCandidate[] {
  return [
    ...generateMemoryCandidates(runId, reviewId, reviewPayload, baseRefs),
    ...generateProceduralCandidates(runId, reviewId, reviewPayload, baseRefs),
    ...generateSelfContinuityCandidates(runId, reviewId, reviewPayload, baseRefs),
    ...generateConnectorEvolutionCandidates(runId, reviewId, reviewPayload, baseRefs),
    ...generateCharacterCandidates(runId, reviewId, reviewPayload, baseRefs),
  ];
}

function validateCandidate(candidate: DreamOutputCandidate): DreamBlockedReason | undefined {
  if (!candidate.candidateText || candidate.candidateText.trim().length === 0) {
    return "dream_blocked_validation_failed";
  }
  if (!candidate.sourceRefs || candidate.sourceRefs.length === 0) {
    return "dream_blocked_validation_failed";
  }
  if (candidate.confidence < 0.1) {
    return "dream_blocked_validation_failed";
  }
  if (candidate.family === "procedural" && !candidate.capabilityPattern) {
    return "dream_blocked_validation_failed";
  }
  if (candidate.family === "connector_evolution" && (!candidate.platformId || !candidate.planType)) {
    return "dream_blocked_validation_failed";
  }
  return undefined;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function runV9DreamConsolidation(
  db: StateDatabase,
  runId: string,
  options?: RunV9DreamConsolidationOptions,
): Promise<RunV9DreamConsolidationResult | DegradedOperationResult> {
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

  if (contentStatus === "placeholder_rejected" || contentStatus === "content_missing" || contentStatus === "empty") {
    return {
      runId,
      status: "blocked",
      candidates: [],
      reason: "dream_blocked_no_content",
      outputFamilies: [],
    };
  }

  const baseRefs = buildSourceRefsFromReview({ id: run.quietReviewId, day: review.day });

  if (baseRefs.length === 0) {
    return {
      runId,
      status: "blocked",
      candidates: [],
      reason: "dream_blocked_validation_failed",
      outputFamilies: [],
    };
  }

  const candidates = generateCandidates(runId, run.quietReviewId, reviewPayload, baseRefs);

  for (const candidate of candidates) {
    if (candidate.validationStatus === "valid") {
      const validationReason = validateCandidate(candidate);
      if (validationReason) {
        candidate.validationStatus = "blocked";
        candidate.validationReason = validationReason;
      }
    }
  }

  if (candidates.length === 0) {
    return {
      runId,
      status: "blocked",
      candidates: [],
      reason: "dream_blocked_no_content",
      outputFamilies: [],
    };
  }

  if (candidates.every((c) => c.validationStatus === "blocked")) {
    const firstReason = candidates[0]?.validationReason as DreamBlockedReason | undefined;
    return {
      runId,
      status: "blocked",
      candidates,
      reason: firstReason ?? "dream_blocked_private_redacted",
      outputFamilies: [],
    };
  }

  const validFamilies = Array.from(
    new Set(
      candidates
        .filter((c) => c.validationStatus === "valid")
        .map((c) => c.family),
    ),
  );

  return {
    runId,
    status: "completed",
    candidates,
    reason: "dream_completed",
    outputFamilies: validFamilies,
  };
}
