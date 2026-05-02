/**
 * Evidence pack assembly, interest-basis selection, and Quiet narrative gate (T6.1.2 / ADR-004).
 * Guidance does not own delivery or judgment; callers pass already-resolved refs.
 */
import type { GuidanceSourceRef } from "./outreach-draft-schema.js";
import type { UserInterestStaleness } from "../storage/user-interest/types.js";
import type { SourceCoverage } from "../storage/snapshots/types.js";

export type SourceCoveragePolicy = "strict" | "lenient";

export interface EvidencePack {
  groundedRefs: GuidanceSourceRef[];
  unresolvedIds: string[];
  sensitiveBlocked: boolean;
  policy: SourceCoveragePolicy;
}

export function buildEvidencePack(
  refs: GuidanceSourceRef[],
  opts?: { policy?: SourceCoveragePolicy },
): { ok: true; pack: EvidencePack } | { ok: false; reasons: string[] } {
  const policy = opts?.policy ?? "strict";
  const unresolvedIds: string[] = [];
  let sensitiveBlocked = false;
  const grounded: GuidanceSourceRef[] = [];
  for (const r of refs) {
    if (!r.uri?.trim()) {
      unresolvedIds.push(r.id);
      continue;
    }
    if (r.uri.includes("credential") || r.uri.includes("secret")) {
      sensitiveBlocked = true;
      continue;
    }
    grounded.push(r);
  }
  if (policy === "strict" && unresolvedIds.length > 0) {
    return { ok: false, reasons: ["unresolved_source_refs", ...unresolvedIds.slice(0, 3)] };
  }
  return {
    ok: true,
    pack: {
      groundedRefs: grounded,
      unresolvedIds,
      sensitiveBlocked,
      policy,
    },
  };
}

export type InterestBasisMode = "evidence_only" | "interest_augmented" | "unavailable";

export function selectInterestBasis(input: {
  staleness: UserInterestStaleness;
  confidence: number;
  signalCount: number;
}): InterestBasisMode {
  if (input.staleness === "insufficient" || input.confidence < 0.15) {
    return input.signalCount > 0 ? "evidence_only" : "unavailable";
  }
  if (input.staleness === "stale") {
    return "evidence_only";
  }
  return "interest_augmented";
}

export function buildQuietNarrativeGuidance(input: {
  interestBasis: InterestBasisMode;
  sourceCoverage: Pick<SourceCoverage, "coverageRatio" | "unsupportedClaims">;
  outline: string[];
}): { status: "ready"; hints: string[] } | { status: "unavailable"; reasons: string[] } {
  if (input.interestBasis === "unavailable" && input.sourceCoverage.coverageRatio < 0.25) {
    return { status: "unavailable", reasons: ["quiet_guidance_insufficient_interest_and_coverage"] };
  }
  if (input.sourceCoverage.unsupportedClaims.length > 0) {
    return { status: "unavailable", reasons: ["quiet_guidance_unsupported_claims"] };
  }
  const hints = [
    ...input.outline.slice(0, 3).map((line) => `hint:${line}`),
    `basis:${input.interestBasis}`,
    `coverage:${input.sourceCoverage.coverageRatio.toFixed(2)}`,
  ];
  return { status: "ready", hints };
}
