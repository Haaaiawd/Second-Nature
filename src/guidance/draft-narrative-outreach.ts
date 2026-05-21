/**
 * T6.1.1 — Narrative Outreach Draft generator.
 *
 * Produces source-backed outreach drafts from evidence + narrative + relationship.
 * Rules-only implementation (no live LLM); honors grounding, redaction, and insufficient_history.
 *
 * NOTE: This function assumes narrativeState.focus / nextIntent and
 * relationshipMemory fields are pre-redacted by upstream state-system.
 * No additional PII filtering is applied here — defense-in-depth is
 * the responsibility of the NarrativeState / RelationshipMemory stores.
 */
import type { NarrativeState, SourceRef } from "../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../storage/relationship/relationship-memory-store.js";

export interface NarrativeOutreachDraftRequest {
  evidenceRefs: SourceRef[];
  narrativeState?: NarrativeState;
  relationshipMemory?: RelationshipMemory;
  platformId?: string;
}

export interface GroundingReport {
  status: "grounded" | "degraded" | "blocked";
  sourceCoverage: number; // 0-1 ratio of claims with source refs
  unsupportedClaims: string[];
  reason: string;
}

export interface NarrativeOutreachDraftResult {
  draft: {
    whatHappened: string;
    whyItMatters: string;
    sourceRefs: SourceRef[];
    tone: "friend" | "insufficient_history" | "blocked";
  };
  groundingReport: GroundingReport;
  promptVersion: string;
}

function computeSourceCoverage(
  claims: string[],
  _evidenceRefs: SourceRef[],
  narrativeSourceRefs?: SourceRef[],
): { coverage: number; unsupported: string[] } {
  if (claims.length === 0) return { coverage: 1, unsupported: [] };
  // Only narrative-level source refs count toward coverage.
  const count = narrativeSourceRefs?.length ?? 0;
  const coverage = Math.min(count / claims.length, 1);
  return {
    coverage,
    unsupported: coverage >= 1 ? [] : claims,
  };
}

export function draftNarrativeOutreach(
  request: NarrativeOutreachDraftRequest,
): NarrativeOutreachDraftResult {
  const { evidenceRefs, narrativeState, relationshipMemory, platformId } = request;

  // T6.1.1 — Block when source refs are missing
  if (!evidenceRefs || evidenceRefs.length === 0) {
    return {
      draft: {
        whatHappened: "",
        whyItMatters: "",
        sourceRefs: [],
        tone: "blocked",
      },
      groundingReport: {
        status: "blocked",
        sourceCoverage: 0,
        unsupportedClaims: ["missing_evidence_refs"],
        reason: "no_source_refs_provided",
      },
      promptVersion: "v6-rules-only-1.0",
    };
  }

  // Build claims from narrative state
  const claims: string[] = [];
  if (narrativeState?.focus) {
    claims.push(narrativeState.focus);
  }
  if (narrativeState?.progress && narrativeState.progress.length > 0) {
    claims.push(...narrativeState.progress);
  }

  const { coverage, unsupported } = computeSourceCoverage(
    claims,
    evidenceRefs,
    narrativeState?.sourceRefs,
  );

  // T6.1.1 — Degrade when source coverage is low
  if (coverage < 0.5) {
    return {
      draft: {
        whatHappened: narrativeState?.focus ?? "",
        whyItMatters: "",
        sourceRefs: evidenceRefs,
        tone: "insufficient_history",
      },
      groundingReport: {
        status: "degraded",
        sourceCoverage: coverage,
        unsupportedClaims: unsupported,
        reason: "insufficient_source_coverage",
      },
      promptVersion: "v6-rules-only-1.0",
    };
  }

  // T6.1.1 — insufficient_history tone when relationship is weak
  const avgAffinity =
    relationshipMemory && relationshipMemory.topicAffinities.length > 0
      ? relationshipMemory.topicAffinities.reduce((s, t) => s + t.affinity, 0) /
        relationshipMemory.topicAffinities.length
      : 0;
  const tone: "friend" | "insufficient_history" =
    avgAffinity < 0.3 ? "insufficient_history" : "friend";

  const whatHappened = narrativeState?.focus ?? "Recent activity observed.";
  const whyItMatters =
    narrativeState?.nextIntent
      ? `This relates to the current focus: ${narrativeState.nextIntent}.`
      : "This may be relevant to your interests.";

  return {
    draft: {
      whatHappened,
      whyItMatters,
      sourceRefs: evidenceRefs,
      tone,
    },
    groundingReport: {
      status: "grounded",
      sourceCoverage: coverage,
      unsupportedClaims: unsupported,
      reason: "source_backed",
    },
    promptVersion: "v6-rules-only-1.0",
  };
}
