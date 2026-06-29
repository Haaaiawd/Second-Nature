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

import type {
  SourceRef,
  SourceRefFamily,
  ProvenanceBundle,
} from "./types/v8-contracts.js";

const PROOF_FAMILIES: ReadonlySet<SourceRefFamily> = new Set([
  "action_closure",
  "audit",
  "connector_result",
]);

const TRACE_FAMILIES: ReadonlySet<SourceRefFamily> = new Set([
  "audit",
]);

function isSyntheticProof(ref: SourceRef): boolean {
  return (
    ref.uri.startsWith("sn://closure/") ||
    ref.uri.startsWith("sn://decision/") ||
    ref.uri.startsWith("sn://policy/") ||
    ref.uri.startsWith("sn://execution/") ||
    ref.uri.startsWith("sn://cycle/") ||
    ref.uri.startsWith("sn://host/") ||
    ref.uri.startsWith("sn://setup/") ||
    PROOF_FAMILIES.has(ref.family)
  );
}

function isTraceRef(ref: SourceRef): boolean {
  return (
    ref.uri.startsWith("sn://cycle/") ||
    ref.uri.startsWith("sn://event/") ||
    TRACE_FAMILIES.has(ref.family)
  );
}

export interface ProvenanceValidationError {
  ok: false;
  field: "sourceRefs" | "proofRefs" | "traceRefs";
  ref: SourceRef;
  reason: string;
}

export type ProvenanceValidationResult =
  | { ok: true; bundle: ProvenanceBundle }
  | { ok: false; errors: ProvenanceValidationError[] };

export function validateProvenanceTiers(
  bundle: ProvenanceBundle,
): ProvenanceValidationResult {
  const errors: ProvenanceValidationError[] = [];

  for (const ref of bundle.sourceRefs) {
    if (isSyntheticProof(ref)) {
      errors.push({
        ok: false,
        field: "sourceRefs",
        ref,
        reason: "Synthetic proof/trace ref must not live in sourceRefs",
      });
    }
  }

  for (const ref of bundle.proofRefs) {
    if (isTraceRef(ref)) {
      errors.push({
        ok: false,
        field: "proofRefs",
        ref,
        reason: "Trace ref must live in traceRefs, not proofRefs",
      });
    }
  }

  return errors.length === 0
    ? { ok: true, bundle }
    : { ok: false, errors };
}

export function buildClosureProvenance(input: {
  sourceRefs?: SourceRef[];
  proofRefs?: SourceRef[];
  traceRefs?: SourceRef[];
}): ProvenanceBundle {
  return {
    sourceRefs: input.sourceRefs ?? [],
    proofRefs: input.proofRefs ?? [],
    traceRefs: input.traceRefs ?? [],
  };
}

export function cycleTraceRef(cycleId: string): SourceRef {
  return {
    uri: `sn://cycle/${cycleId}`,
    family: "audit",
    id: cycleId,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

export function closureTraceRef(closureId: string): SourceRef {
  return {
    uri: `sn://closure/${closureId}`,
    family: "action_closure",
    id: closureId,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

export function decisionProofRef(decisionId: string): SourceRef {
  return {
    uri: `sn://decision/${decisionId}`,
    family: "action_closure",
    id: decisionId,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}
