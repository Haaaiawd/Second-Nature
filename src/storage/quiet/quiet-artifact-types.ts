import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";

export type QuietArtifactKind = "daily_report" | "narrative_reflection" | "curated_memory_candidate" | "empty_state";

export type QuietClaimType = "fact" | "emotion" | "interpretation" | "next_step";

export interface QuietClaim {
  id: string;
  text: string;
  sourceRefs: LifeEvidenceSourceRef[];
  claimType: QuietClaimType;
}

export interface QuietArtifactWrite {
  day: string;
  kind: QuietArtifactKind;
  title: string;
  body: string;
  claims: QuietClaim[];
  sourceRefs: LifeEvidenceSourceRef[];
  memoryCandidateRefs?: LifeEvidenceSourceRef[];
}
