/**
 * Narrative Update Proposal
 *
 * Core logic: generate a narrative update proposal based on evidence and
 * extracted insights. Claims must be source-backed; unsupported claims are
 * flagged and the proposal is degraded or blocked.
 *
 * - Focus: most prominent theme from insights or evidence.
 * - Progress: learning and observation insights mapped to progress entries.
 * - NextIntent: inferred from unresolved conflicts or high-priority patterns.
 * Test coverage: tests/unit/dream/t7-1-4-narrative-update.test.ts
 */

import type { DreamNarrativeUpdate } from "./types.js";

export interface NarrativeProposalInput {
  evidenceSummaries: Array<{
    id: string;
    summary: string;
    createdAt: string;
  }>;
  insights: Array<{
    id: string;
    type: "pattern" | "learning" | "observation" | "conflict";
    summary: string;
    sourceRefs: string[];
    confidence: number;
  }>;
  priorFocus?: string;
}

export interface NarrativeProposalResult {
  proposal?: DreamNarrativeUpdate;
  unsupportedClaims: string[];
  blocked: boolean;
}

export function draftNarrativeFromDream(
  input: NarrativeProposalInput,
): NarrativeProposalResult {
  const unsupportedClaims: string[] = [];

  if (input.evidenceSummaries.length === 0 && input.insights.length === 0) {
    return {
      unsupportedClaims: ["no_evidence_for_narrative"],
      blocked: true,
    };
  }

  // Focus: highest-confidence insight summary, or first evidence if no insights
  let focus = input.priorFocus ?? "continue exploration";
  const highConfidenceInsights = input.insights.filter((i) => i.confidence >= 0.6);
  if (highConfidenceInsights.length > 0) {
    // Pick the insight with highest confidence
    const top = highConfidenceInsights.sort((a, b) => b.confidence - a.confidence)[0]!;
    focus = top.summary.slice(0, 120);
  } else if (input.evidenceSummaries.length > 0) {
    focus = input.evidenceSummaries[0]!.summary.slice(0, 120);
  }

  // Progress: learning + observation insights become progress entries
  const progressAdditions: string[] = [];
  for (const insight of input.insights) {
    if (insight.type === "learning" || insight.type === "observation") {
      progressAdditions.push(insight.summary.slice(0, 200));
    }
  }
  if (progressAdditions.length === 0 && input.evidenceSummaries.length > 0) {
    // Fallback: use most recent evidence as progress
    const recent = [...input.evidenceSummaries].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    )[0];
    if (recent) {
      progressAdditions.push(recent.summary.slice(0, 200));
    }
  }

  // NextIntent: if conflicts exist, intent is to resolve; otherwise continue
  const hasConflict = input.insights.some((i) => i.type === "conflict");
  const nextIntent = hasConflict
    ? "resolve_conflicts_and_validate"
    : "continue_current_focus";

  // Source refs: collect all insight source refs + evidence ids
  const sourceRefs = new Set<string>();
  for (const insight of input.insights) {
    for (const ref of insight.sourceRefs) {
      sourceRefs.add(ref);
    }
  }
  for (const ev of input.evidenceSummaries) {
    sourceRefs.add(ev.id);
  }

  // Confidence: average of insight confidences, or 0.5 fallback
  const avgConfidence =
    input.insights.length > 0
      ? input.insights.reduce((sum, i) => sum + i.confidence, 0) /
        input.insights.length
      : 0.5;

  // Degrade if confidence too low
  if (avgConfidence < 0.3) {
    unsupportedClaims.push("low_average_confidence_for_narrative");
  }

  const blocked = unsupportedClaims.length > 0 && avgConfidence < 0.2;

  return {
    proposal: {
      focus,
      progressAdditions: progressAdditions.slice(0, 20),
      nextIntent,
      confidenceDelta: Number(avgConfidence.toFixed(2)),
      sourceRefs: Array.from(sourceRefs).slice(0, 50),
      unsupportedClaims,
    },
    unsupportedClaims,
    blocked,
  };
}
