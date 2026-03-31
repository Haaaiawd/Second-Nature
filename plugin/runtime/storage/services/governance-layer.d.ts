import type { StateDatabase } from "../db/index.js";
import { ProposalRepository } from "../repositories/proposal-repository.js";
import { AssetRepository } from "../repositories/asset-repository.js";
import { ProvenanceRepository } from "../repositories/provenance-repository.js";
export interface AnchorWriteProposal {
    id: string;
    targetAssetId: string;
    beforeHash?: string;
    afterHash?: string;
    status: "draft" | "requires_review" | "approved" | "rejected" | "applied" | "conflicted";
    proposedDiff: string;
    reason: string;
    supportingSources: string[];
    confidence: number;
    policyBasis?: string[];
    riskFlags?: string[];
    createdAt: string;
}
export interface ProposalAck {
    proposalId: string;
    proposalPath: string;
    status: string;
}
export interface ApplyAck {
    applied: boolean;
    assetId: string;
    hash: string;
}
export declare class GovernanceLayer {
    private readonly proposalRepository;
    private readonly assetRepository;
    private readonly provenanceRepository;
    constructor(proposalRepository: ProposalRepository, assetRepository: AssetRepository, provenanceRepository: ProvenanceRepository);
    proposeAnchorWrite(proposal: AnchorWriteProposal): Promise<ProposalAck>;
    applyGovernedAnchorWrite(proposalId: string): Promise<ApplyAck>;
    approveProposal(proposalId: string): Promise<void>;
    rejectProposal(proposalId: string): Promise<void>;
    loadProposal(proposalId: string): Promise<AnchorWriteProposal | null>;
}
export declare function createGovernanceLayer(database: StateDatabase): GovernanceLayer;
