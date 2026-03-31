import type { StateDatabase } from "../db/index.js";
import { ProvenanceRepository } from "../repositories/provenance-repository.js";
import { ProposalRepository } from "../repositories/proposal-repository.js";
import { AssetRepository } from "../repositories/asset-repository.js";
export interface ProvenanceTrace {
    assetId: string;
    upstreamSources: string[];
    proposalIds: string[];
    applyIds: string[];
}
export interface ProvenanceDetail {
    assetId: string;
    assetPath?: string;
    assetHash?: string;
    assetVersion?: number;
    currentContent?: string;
    provenance: ProvenanceTrace;
    proposals?: Array<{
        id: string;
        status: string;
        targetAssetId: string;
        proposedDiff: string;
        reason: string;
        confidence: number;
        supportingSources: string[];
    }>;
    applies?: Array<{
        id: string;
        beforeHash: string;
        afterHash: string;
    }>;
}
export declare class ProvenanceService {
    private readonly provenanceRepository;
    private readonly proposalRepository;
    private readonly assetRepository;
    constructor(provenanceRepository: ProvenanceRepository, proposalRepository: ProposalRepository, assetRepository: AssetRepository);
    explainProvenance(assetId: string): Promise<ProvenanceDetail>;
}
export declare function createProvenanceService(database: StateDatabase): ProvenanceService;
