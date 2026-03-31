import type { AssetRepository } from "../repositories/asset-repository.js";
import type { ProvenanceRepository } from "../repositories/provenance-repository.js";
export interface ActivityLogWrite {
    id: string;
    timestamp: string;
    platform?: string;
    kind: "browse" | "action" | "failure" | "task" | "heartbeat";
    content: string;
    sourceRefs: string[];
}
export interface ObservationWrite {
    id: string;
    timestamp: string;
    summary: string;
    mood?: string;
    sourceRefs: string[];
}
export interface DailyReportInput {
    day: string;
    summary: string;
    highlights: string[];
    activityRefs: string[];
    observationRefs: string[];
}
export interface CuratedMemoryWrite {
    id: string;
    title: string;
    summary: string;
    confidence: number;
    ttlClass: "short" | "medium" | "long";
    sourceRefs: string[];
    supersedes?: string[];
}
export interface AssetWriteAck {
    assetPath: string;
    hash: string;
}
export declare class DailyLogPipeline {
    private readonly assetRepository;
    private readonly provenanceRepository;
    constructor(assetRepository: AssetRepository, provenanceRepository: ProvenanceRepository);
    appendActivityLog(entry: ActivityLogWrite): Promise<AssetWriteAck>;
    appendObservation(entry: ObservationWrite): Promise<AssetWriteAck>;
    generateDailyReport(input: DailyReportInput): Promise<AssetWriteAck>;
    upsertCuratedMemory(candidate: CuratedMemoryWrite): Promise<AssetWriteAck>;
}
export declare function createDailyLogPipeline(assetRepository: AssetRepository, provenanceRepository: ProvenanceRepository): DailyLogPipeline;
