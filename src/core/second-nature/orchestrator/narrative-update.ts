/**
 * T2.1.5 — NarrativeState update after heartbeat effect/fallback.
 *
 * Produces a source-backed narrative revision or an honest empty-state
 * (`awaiting_sources` / `insufficient_sources`) based on the cycle result.
 *
 * Rules-only implementation; no live LLM.
 */
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import type { CandidateIntent } from "../types.js";
import type { PlannerLifeEvidenceSlice } from "../heartbeat/runtime-snapshot.js";
import type {
  NarrativeState,
  NarrativeStateUpdate,
  SourceRef,
} from "../../../storage/narrative/narrative-state-store.js";

const MAX_PROGRESS_ENTRIES = 10;
const DEFAULT_NARRATIVE_ID = "default";

function mapControlPlaneRefToSourceRef(
  ref: import("../types.js").ControlPlaneSourceRef,
): SourceRef {
  return {
    sourceId: ref.id,
    kind: ref.kind,
    url: ref.uri,
    snippet: ref.excerptHash,
  };
}

/**
 * Compute narrative confidence based on source evidence.
 *
 * Formula: smooth sigmoid-like growth:
 *   - 0 sources → 0
 *   - 1 source → 0.35 (not 0.43; single-source is weak but non-zero)
 *   - 2 sources → 0.60 (beginning to be trustworthy)
 *   - 3 sources → 0.80 (strong confidence, not 1.0)
 *   - 4+ sources → 0.90 (cap below 1.0 to avoid false certainty)
 *   - Boost: +0.05 if corroborating life evidence exists
 *   - Hard cap at 0.95 (never claim 100% certainty from evidence count alone)
 *
 * Rationale: linear 1/3 per source produces unnatural jumps.
 * Logarithmic growth better models diminishing returns per extra source.
 */
function computeConfidence(
  intentSources: number,
  lifeEvidenceSources: number,
): number {
  if (intentSources === 0 && lifeEvidenceSources === 0) return 0;
  const base = intentSources === 0
    ? 0
    : intentSources === 1
      ? 0.35
      : intentSources === 2
        ? 0.60
        : intentSources === 3
          ? 0.80
          : 0.90;
  const boost = lifeEvidenceSources > 0 ? 0.05 : 0;
  return Math.min(base + boost, 0.95);
}

export interface UpdateNarrativeAfterEffectInput {
  result: HeartbeatCycleResult;
  selectedIntent?: CandidateIntent;
  lifeEvidence: PlannerLifeEvidenceSlice;
  priorNarrative?: NarrativeState | null;
}

/**
 * Build the next NarrativeState revision from a completed heartbeat cycle.
 *
 * - `intent_selected` + sources → `active`, focus/progress updated.
 * - `intent_selected` without sources → `awaiting_sources`, claim recorded as unsupported.
 * - No action (heartbeat_ok / denied / deferred / etc.) → preserve prior state or
 *   seed an empty `awaiting_sources` state when no prior exists.
 */
export function updateNarrativeAfterEffect(
  input: UpdateNarrativeAfterEffectInput,
): NarrativeStateUpdate {
  const { result, selectedIntent, lifeEvidence, priorNarrative } = input;
  const now = new Date().toISOString();
  const prior = priorNarrative ?? null;
  const narrativeId = prior?.narrativeId ?? DEFAULT_NARRATIVE_ID;
  const nextRevision = (prior?.revision ?? 0) + 1;

  // --- intent_selected branch ------------------------------------------------
  if (result.status === "intent_selected" && selectedIntent) {
    const hasIntentSources = selectedIntent.sourceRefs.length > 0;
    const hasLifeEvidence = !(
      lifeEvidence.evidenceRefs.length === 0 &&
      lifeEvidence.platformEventCount === 0 &&
      lifeEvidence.workEventCount === 0
    );
    const sourceRefs = selectedIntent.sourceRefs.map(mapControlPlaneRefToSourceRef);

    if (hasIntentSources || hasLifeEvidence) {
      // Source-backed revision
      // L-03: Use effectClass + id as dedup key instead of full summary text.
      const progressEntry = `${selectedIntent.effectClass}: ${selectedIntent.id}`;
      const progress = [...(prior?.progress ?? [])];
      if (!progress.includes(progressEntry)) {
        progress.push(progressEntry);
      }
      const boundedProgress = progress.slice(-MAX_PROGRESS_ENTRIES);

      return {
        narrativeId,
        revision: nextRevision,
        focus: selectedIntent.summary,
        progress: boundedProgress,
        nextIntent: "continue",
        confidence: computeConfidence(
          selectedIntent.sourceRefs.length,
          lifeEvidence.evidenceRefs.length,
        ),
        sourceRefs,
        unsupportedClaims: [],
        status: "active",
        updatedAt: now,
      };
    }

    // No sources → awaiting_sources
    return {
      narrativeId,
      revision: nextRevision,
      focus: prior?.focus ?? "awaiting_evidence",
      progress: prior?.progress ?? [],
      nextIntent: "await_sources",
      confidence: 0,
      sourceRefs: [],
      unsupportedClaims: [selectedIntent.summary],
      status: "awaiting_sources",
      updatedAt: now,
    };
  }

  // --- No action / fallback branches -----------------------------------------
  if (prior) {
    // Preserve existing state, bump revision and timestamp so observers
    // know the heartbeat cycle ran even when no intent was selected.
    return {
      ...prior,
      revision: nextRevision,
      updatedAt: now,
    };
  }

  // No prior state and no action → seed empty awaiting_sources state
  return {
    narrativeId,
    revision: nextRevision,
    focus: "awaiting_evidence",
    progress: [],
    nextIntent: "await_sources",
    confidence: 0,
    sourceRefs: [],
    unsupportedClaims: [],
    status: "awaiting_sources",
    updatedAt: now,
  };
}
