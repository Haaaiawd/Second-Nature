export declare const ASSET_CONFIG: {
    readonly workspaceRoot: "./workspace";
    readonly journalsDir: "memory";
    readonly reportsDir: "memory/reports";
    readonly curatedDir: "memory/curated";
    readonly proposalsDir: "memory/proposals";
    readonly anchorAssets: readonly ["SOUL.md", "USER.md", "IDENTITY.md", "MEMORY.md", "AGENTS.md"];
};
export declare function ensureDirectory(dirPath: string): Promise<void>;
export declare function resolveDailyJournalPath(timestamp: string): string;
export declare function resolveDailyReportPath(day: string): string;
export declare function resolveCuratedPath(id: string): string;
export declare function resolveProposalPath(proposalId: string): string;
export declare function resolveAnchorPath(assetName: string): string;
export declare function writeCanonicalArtifact(filePath: string, content: string): Promise<void>;
export declare function appendLine(filePath: string, line: string): Promise<void>;
export declare function readText(filePath: string): Promise<string>;
export declare function hashFile(filePath: string): Promise<string>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function buildJournalAssetId(filePath: string): string;
export declare function buildReportAssetId(day: string): string;
export declare function serializeActivityLog(entry: {
    id: string;
    timestamp: string;
    platform?: string;
    kind: string;
    content: string;
    sourceRefs: string[];
}): string;
export declare function serializeObservation(entry: {
    id: string;
    timestamp: string;
    summary: string;
    mood?: string;
    sourceRefs: string[];
}): string;
export declare function renderDailyReport(input: {
    day: string;
    summary: string;
    highlights: string[];
    activityRefs: string[];
    observationRefs: string[];
}): string;
export declare function renderCuratedMemory(item: {
    id: string;
    title: string;
    summary: string;
    confidence: number;
    ttlClass: string;
    sourceRefs: string[];
}): string;
export declare function renderProposal(proposal: {
    id: string;
    targetAssetId: string;
    proposedDiff: string;
    reason: string;
    supportingSources: string[];
    status: string;
}): string;
export declare function applyDiff(original: string, diff: string): string;
export declare function buildCuratedAssetId(id: string): string;
export declare function buildAnchorAssetId(name: string): string;
