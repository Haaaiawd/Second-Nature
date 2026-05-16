/**
 * T6.1.1 — Narrative Outreach Draft generator.
 *
 * Produces source-backed outreach drafts from evidence + narrative + relationship.
 * Rules-only implementation (no live LLM); honors grounding, redaction, and insufficient_history.
 *
 * NOTE: This function assumes narrativeState.focus / nextIntent and
 * relationshipMemory fields are pre-redacted by upstream state-system.
 * No additional PII filtering is applied here — defense-in-depth is
 * the responsibility of the NarrativeState / RelationshipMemory stores.
 */
import type { NarrativeState, SourceRef } from "../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../storage/relationship/relationship-memory-store.js";
export interface NarrativeOutreachDraftRequest {
    evidenceRefs: SourceRef[];
    narrativeState?: NarrativeState;
    relationshipMemory?: RelationshipMemory;
    platformId?: string;
}
export interface GroundingReport {
    status: "grounded" | "degraded" | "blocked";
    sourceCoverage: number;
    unsupportedClaims: string[];
    reason: string;
}
export interface NarrativeOutreachDraftResult {
    draft: {
        whatHappened: string;
        whyItMatters: string;
        sourceRefs: SourceRef[];
        tone: "friend" | "insufficient_history" | "blocked";
    };
    groundingReport: GroundingReport;
    promptVersion: string;
}
export declare function draftNarrativeOutreach(request: NarrativeOutreachDraftRequest): NarrativeOutreachDraftResult;
