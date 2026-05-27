/**
 * Dream input sampler.
 *
 * Core logic: when evidence count exceeds threshold, sample recent 7 days
 * plus key events (outreach, owner reply, goal milestone, high-confidence refs).
 * Goal: prevent token/cost explosion before LLM stage.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */
export interface SamplerInput {
    evidenceSummaries: Array<{
        id: string;
        summary: string;
        createdAt: string;
        kind?: string;
        confidence?: number;
    }>;
    chronicleSummaries: Array<{
        id: string;
        summary: string;
        createdAt: string;
    }>;
    evidenceLimit?: number;
}
export interface SamplerResult {
    sampledEvidenceIds: string[];
    sampledChronicleIds: string[];
    droppedCount: number;
    reason: string;
}
export declare function sampleDreamInput(input: SamplerInput): SamplerResult;
