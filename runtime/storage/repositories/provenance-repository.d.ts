import type { StateDatabase } from "../db/index.js";
import { type NewProvenanceEdgeRecord, type ProvenanceEdgeRecord } from "../db/schema/index.js";
export declare class ProvenanceRepository {
    private readonly database;
    constructor(database: StateDatabase);
    create(record: NewProvenanceEdgeRecord): Promise<void>;
    listByTarget(toId: string): Promise<ProvenanceEdgeRecord[]>;
    linkEntrySources(entryId: string, sourceRefs: string[]): Promise<void>;
    traceAsset(assetId: string): Promise<{
        assetId: string;
        upstreamSources: string[];
        proposalIds: string[];
        applyIds: string[];
    }>;
    recordApply(proposalId: string, assetId: string, info: {
        beforeHash: string;
        afterHash: string;
        diff: string;
    }): Promise<void>;
}
