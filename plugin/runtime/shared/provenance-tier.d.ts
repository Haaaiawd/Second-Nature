/**
 * Provenance Tier Validator (T-SH.R.6)
 *
 * Core logic: enforce that real domain evidence lives in `sourceRefs`,
 * runtime/policy/setup/host/packaging proofs live in `proofRefs`, and
 * observability/audit/stage-event traces live in `traceRefs`.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §2.2`
 *
 * Dependencies: `src/shared/types/v8-contracts.js`
 * Boundary: pure functions; no I/O.
 * Test coverage: tests/unit/shared/provenance-tier.test.ts
 */
import type { SourceRef, ProvenanceBundle } from "./types/v8-contracts.js";
export interface ProvenanceValidationError {
    ok: false;
    field: "sourceRefs" | "proofRefs" | "traceRefs";
    ref: SourceRef;
    reason: string;
}
export type ProvenanceValidationResult = {
    ok: true;
    bundle: ProvenanceBundle;
} | {
    ok: false;
    errors: ProvenanceValidationError[];
};
export declare function validateProvenanceTiers(bundle: ProvenanceBundle): ProvenanceValidationResult;
export declare function buildClosureProvenance(input: {
    sourceRefs?: SourceRef[];
    proofRefs?: SourceRef[];
    traceRefs?: SourceRef[];
}): ProvenanceBundle;
export declare function cycleTraceRef(cycleId: string): SourceRef;
export declare function closureTraceRef(closureId: string): SourceRef;
export declare function decisionProofRef(decisionId: string): SourceRef;
