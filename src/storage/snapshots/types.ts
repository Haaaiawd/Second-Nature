/**
 * Read-model snapshots aligned with state-system v5 (subset for S1/S2).
 */
import type { LifeEvidenceType, SourceRef } from "../life-evidence/types.js";

export interface LifeEvidenceQuery {
  windowStart?: string;
  windowEnd?: string;
  evidenceTypes?: LifeEvidenceType[];
  limit?: number;
}

export interface SourceCoverage {
  coverageRatio: number;
  unsupportedClaims: string[];
  claimCoverage: Array<{ claimId: string; backed: boolean; sourceRefs: SourceRef[] }>;
}

export interface LifeEvidenceReadModel {
  id: string;
  timestamp: string;
  evidenceType: LifeEvidenceType;
  platformId?: string;
  summary: string;
  rawContentRef?: string;
  sourceRefs: SourceRef[];
  sensitivity: import("../life-evidence/types.js").Sensitivity;
  confidence: number;
  tags: string[];
  producer: string;
}

export interface LifeEvidenceSnapshot {
  snapshotId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  evidenceRefs: SourceRef[];
  platformEvents: LifeEvidenceReadModel[];
  workEvents: LifeEvidenceReadModel[];
  userInteractionEvents: LifeEvidenceReadModel[];
  quietArtifacts: SourceRef[];
  coverage: SourceCoverage;
  empty: boolean;
}

export interface ContinuitySnapshot {
  snapshotId: string;
  generatedAt: string;
  lastHeartbeatAt?: string;
  recentDecisionRefs: SourceRef[];
  openObligations: SourceRef[];
  quietDebt: {
    hasUnprocessedEvidence: boolean;
    oldestUnprocessedEvidenceAt?: string;
    pendingCount: number;
  };
  fallbackRefs: SourceRef[];
}
