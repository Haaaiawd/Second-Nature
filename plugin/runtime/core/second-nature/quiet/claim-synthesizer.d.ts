/**
 * ClaimSynthesizer — T-DQS.C.1
 *
 * Core logic: Transform aggregated life evidence into source-backed QuietClaims.
 * - EvidenceAggregator: group and summarize raw evidence candidates
 * - ClaimDeduplicator: remove duplicate claims by sourceRef key
 * - ClaimSynthesizer: map evidence -> claim kind (observation/fact/pattern)
 * - SourceValidator: reject fact claims with empty sourceRefs (DR-025)
 *
 * Rules:
 * - Single weak evidence (confidence < 0.5, count == 1) → observation only
 * - Multiple evidence or confidence >= 0.5 → fact
 * - Pattern requires >= 3 related evidence with confidence >= 0.7
 * - Fact claim sourceRefs must be non-empty tuple (DR-025)
 * - SourceValidator returns claim_source_missing for empty sourceRefs
 *
 * Dependencies:
 * - `QuietClaim`, `QuietClaimKind` from `../../../shared/types/v7-entities.js`
 * - `LifeEvidenceCandidate` from `../../../storage/life-evidence/types.js`
 *
 * Test coverage: tests/unit/quiet/claim-synthesizer.test.ts
 */
import type { QuietClaim } from "../../../shared/types/v7-entities.js";
import type { LifeEvidenceCandidate } from "../../../storage/life-evidence/types.js";
export interface EvidenceSlice {
    items: LifeEvidenceCandidate[];
    summary: string;
}
export interface ClaimSynthesisResult {
    claims: QuietClaim[];
    errors: string[];
}
export interface EvidenceAggregator {
    aggregate(candidates: LifeEvidenceCandidate[]): EvidenceSlice;
}
export interface ClaimDeduplicator {
    deduplicate(claims: QuietClaim[]): QuietClaim[];
}
export interface ClaimSynthesizer {
    synthesize(slice: EvidenceSlice): ClaimSynthesisResult;
}
export interface SourceValidator {
    validate(claim: QuietClaim): {
        ok: true;
    } | {
        ok: false;
        reason: string;
    };
}
export declare function createEvidenceAggregator(): EvidenceAggregator;
export declare function createClaimDeduplicator(): ClaimDeduplicator;
export declare function createClaimSynthesizer(): ClaimSynthesizer;
export declare function createSourceValidator(): SourceValidator;
