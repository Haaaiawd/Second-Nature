import type { SourceRef } from "../life-evidence/types.js";
import type { SourceCoverage } from "../snapshots/types.js";
import type { QuietArtifactWrite } from "./quiet-artifact-types.js";
import type { QuietClaim } from "./quiet-artifact-types.js";
export declare function calculateQuietSourceCoverage(claims: QuietClaim[]): SourceCoverage;
/** Ratio of factual claims whose refs intersect the artifact's evidence bundle (T4.4.1). */
export declare function evidenceGroundingRatio(input: Pick<QuietArtifactWrite, "claims" | "sourceRefs">): number;
export interface QuietArtifactAck {
    artifactId: string;
    artifactRef: SourceRef;
    sourceCoverage: SourceCoverage;
}
export declare function writeQuietArtifact(input: QuietArtifactWrite, opts?: {
    minimumCoverageRatio?: number;
}): QuietArtifactAck;
