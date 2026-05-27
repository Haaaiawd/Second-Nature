/**
 * Insight Extractor
 *
 * Core logic: extract source-grounded insight candidates from sampled evidence.
 * Rules-based (no LLM required) using keyword patterns, frequency counts, and
 * temporal clustering. Each insight carries type, summary, sourceRefs, and confidence.
 *
 * - Pattern: recurring themes across multiple evidence entries.
 * - Learning: new skills or behaviors observed over time.
 * - Observation: one-off notable events.
 * - Conflict: contradictory claims or repeated failures.
 * Test coverage: tests/unit/dream/t7-1-3-insight-extraction.test.ts
 */
import type { DreamInsight } from "./types.js";
export interface ExtractInsightsInput {
    evidenceSummaries: Array<{
        id: string;
        summary: string;
        createdAt: string;
        kind?: string;
    }>;
    chronicleSummaries: Array<{
        id: string;
        summary: string;
        createdAt: string;
    }>;
    redacted?: boolean;
}
export declare function extractInsights(input: ExtractInsightsInput): {
    insights: DreamInsight[];
    unsupportedClaims: string[];
};
