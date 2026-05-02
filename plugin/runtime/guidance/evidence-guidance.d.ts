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
export declare function buildEvidencePack(refs: GuidanceSourceRef[], opts?: {
    policy?: SourceCoveragePolicy;
}): {
    ok: true;
    pack: EvidencePack;
} | {
    ok: false;
    reasons: string[];
};
export type InterestBasisMode = "evidence_only" | "interest_augmented" | "unavailable";
export declare function selectInterestBasis(input: {
    staleness: UserInterestStaleness;
    confidence: number;
    signalCount: number;
}): InterestBasisMode;
export declare function buildQuietNarrativeGuidance(input: {
    interestBasis: InterestBasisMode;
    sourceCoverage: Pick<SourceCoverage, "coverageRatio" | "unsupportedClaims">;
    outline: string[];
}): {
    status: "ready";
    hints: string[];
} | {
    status: "unavailable";
    reasons: string[];
};
