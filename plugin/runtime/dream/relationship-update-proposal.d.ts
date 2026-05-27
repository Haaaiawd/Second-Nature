/**
 * Relationship Update Proposal
 *
 * Core logic: generate relationship update proposal based on chronicle entries.
 * Tone/timing/topic deltas include sourceRefs and confidence.
 * Owner no-reply signal is recorded as cooldown without inventing preference.
 * Prevents over-inference from single samples.
 * Test coverage: tests/unit/dream/t7-1-5-relationship-update.test.ts
 */
import type { DreamRelationshipUpdate } from "./types.js";
export interface RelationshipProposalInput {
    chronicleEntries: Array<{
        id: string;
        summary: string;
        createdAt: string;
        kind?: string;
    }>;
    priorTone?: string;
    priorTiming?: string;
    priorTopic?: string;
}
export interface RelationshipProposalResult {
    proposal?: DreamRelationshipUpdate;
    unsupportedClaims: string[];
    cooldown?: boolean;
}
export declare function draftRelationshipFromDream(input: RelationshipProposalInput): RelationshipProposalResult;
