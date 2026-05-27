/**
 * Narrative Update Proposal
 *
 * Core logic: generate a narrative update proposal based on evidence and
 * extracted insights. Claims must be source-backed; unsupported claims are
 * flagged and the proposal is degraded or blocked.
 *
 * - Focus: most prominent theme from insights or evidence.
 * - Progress: learning and observation insights mapped to progress entries.
 * - NextIntent: inferred from unresolved conflicts or high-priority patterns.
 * Test coverage: tests/unit/dream/t7-1-4-narrative-update.test.ts
 */
import type { DreamNarrativeUpdate } from "./types.js";
export interface NarrativeProposalInput {
    evidenceSummaries: Array<{
        id: string;
        summary: string;
        createdAt: string;
    }>;
    insights: Array<{
        id: string;
        type: "pattern" | "learning" | "observation" | "conflict";
        summary: string;
        sourceRefs: string[];
        confidence: number;
    }>;
    priorFocus?: string;
}
export interface NarrativeProposalResult {
    proposal?: DreamNarrativeUpdate;
    unsupportedClaims: string[];
    blocked: boolean;
}
export declare function draftNarrativeFromDream(input: NarrativeProposalInput): NarrativeProposalResult;
