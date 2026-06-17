/**
 * Quiet artifact validation + source coverage gate (T4.4.1 / ADR-003).
 * Returns artifact identity for persistence layers; does not write FS/SQLite here.
 */
import * as crypto from "node:crypto";
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
import type { SourceCoverage } from "../snapshots/types.js";
import type { QuietArtifactWrite } from "./quiet-artifact-types.js";
import type { QuietClaim } from "./quiet-artifact-types.js";

const DEFAULT_MIN_COVERAGE_RATIO = 0.51;

export function calculateQuietSourceCoverage(claims: QuietClaim[]): SourceCoverage {
  const factual = claims.filter((c) => c.claimType === "fact");
  const claimCoverage = claims.map((c) => {
    const backed = c.claimType !== "fact" || c.sourceRefs.length > 0;
    return { claimId: c.id, backed, sourceRefs: [...c.sourceRefs] };
  });
  const unsupportedClaims = claimCoverage.filter((x) => !x.backed).map((x) => x.claimId);
  const coverageRatio =
    factual.length === 0 ? 1 : factual.filter((c) => c.sourceRefs.length > 0).length / factual.length;
  return { coverageRatio, unsupportedClaims, claimCoverage };
}

/** Ratio of factual claims whose refs intersect the artifact's evidence bundle (T4.4.1). */
export function evidenceGroundingRatio(input: Pick<QuietArtifactWrite, "claims" | "sourceRefs">): number {
  const allowedIds = new Set(input.sourceRefs.map((s) => s.id));
  const facts = input.claims.filter((c) => c.claimType === "fact");
  if (facts.length === 0) return 1;
  let grounded = 0;
  for (const f of facts) {
    if (f.sourceRefs.length === 0) continue;
    if (f.sourceRefs.some((r) => allowedIds.has(r.id))) grounded += 1;
  }
  return grounded / facts.length;
}

export interface QuietArtifactAck {
  artifactId: string;
  artifactRef: LifeEvidenceSourceRef;
  sourceCoverage: SourceCoverage;
}

export function writeQuietArtifact(
  input: QuietArtifactWrite,
  opts?: { minimumCoverageRatio?: number },
): QuietArtifactAck {
  const minCov = opts?.minimumCoverageRatio ?? DEFAULT_MIN_COVERAGE_RATIO;
  if (input.sourceRefs.length === 0 && input.kind !== "empty_state") {
    throw new Error("quiet_artifact_requires_source_refs");
  }

  const localCoverage = calculateQuietSourceCoverage(input.claims);
  if (input.kind !== "empty_state" && localCoverage.unsupportedClaims.length > 0) {
    throw new Error("quiet_artifact_unsupported_factual_claim");
  }

  const grounding = evidenceGroundingRatio(input);
  if (input.kind !== "empty_state" && grounding < minCov) {
    throw new Error("quiet_artifact_source_coverage_too_low");
  }

  const artifactId = crypto.randomUUID();
  const artifactRef: LifeEvidenceSourceRef = {
    id: `quiet:${artifactId}`,
    kind: "workspace_artifact",
    uri: `urn:second-nature:quiet:${input.day}:${input.kind}:${artifactId}`,
  };

  const sourceCoverage: SourceCoverage = {
    ...localCoverage,
    coverageRatio: input.kind === "empty_state" ? 1 : grounding,
  };

  return { artifactId, artifactRef, sourceCoverage };
}
