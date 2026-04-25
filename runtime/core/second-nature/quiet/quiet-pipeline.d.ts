import type { TopLevelMode } from "../types.js";
export interface QuietInputBundle {
    journalEntries: Array<{
        id: string;
        content: string;
        timestamp: string;
        sourceRefs?: string[];
    }>;
    dailyReports: Array<{
        id: string;
        summary: string;
        highlights: string[];
        sources: string[];
    }>;
}
export interface MemoryCurationResult {
    summary: string;
    highlights: string[];
    sourceRefs: string[];
    excludedCompactionArtifacts: string[];
}
export interface QuietState {
    mode: TopLevelMode;
    reflectionDebt: number;
    missedReflectionCount: number;
    mustRunBy?: string;
}
export declare function runQuietPipeline(input: {
    quietState: QuietState;
    bundle: QuietInputBundle;
}): {
    shouldRunReflection: boolean;
    curation: MemoryCurationResult;
};
