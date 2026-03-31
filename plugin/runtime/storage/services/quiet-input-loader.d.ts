import type { AssetRepository } from "../repositories/asset-repository.js";
export interface CurationInputQuery {
    dateRange?: {
        start: string;
        end: string;
    };
    assetFilters?: {
        includeJournal?: boolean;
        includeReports?: boolean;
        includeCurated?: boolean;
    };
}
export interface JournalEntry {
    id: string;
    timestamp: string;
    content: string;
    category: string;
}
export interface ReportEntry {
    id: string;
    day: string;
    summary: string;
    highlights: string[];
    sources: string[];
}
export interface CurationInputBundle {
    journalEntries: JournalEntry[];
    dailyReports: ReportEntry[];
    sourceCount: number;
}
export declare class QuietInputLoader {
    private readonly assetRepository;
    constructor(assetRepository: AssetRepository);
    loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle>;
    private loadJournalEntries;
    private loadSingleDayJournal;
    private loadReportEntries;
    private loadSingleDayReport;
}
export declare function createQuietInputLoader(assetRepository: AssetRepository): QuietInputLoader;
