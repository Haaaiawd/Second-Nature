import { ProposalRepository } from "../repositories/proposal-repository.js";
import { AssetRepository } from "../repositories/asset-repository.js";
import { ProvenanceRepository } from "../repositories/provenance-repository.js";
import { writeCanonicalArtifact, readText, hashFile, resolveProposalPath, renderProposal, applyDiff, } from "../memory/workspace/paths.js";
const CONFIDENCE_THRESHOLD_FOR_ANCHOR = 0.8;
export class GovernanceLayer {
    proposalRepository;
    assetRepository;
    provenanceRepository;
    constructor(proposalRepository, assetRepository, provenanceRepository) {
        this.proposalRepository = proposalRepository;
        this.assetRepository = assetRepository;
        this.provenanceRepository = provenanceRepository;
    }
    async proposeAnchorWrite(proposal) {
        if (!proposal.supportingSources.length) {
            throw new Error("anchor_proposal_requires_sources");
        }
        if (proposal.confidence < CONFIDENCE_THRESHOLD_FOR_ANCHOR) {
            throw new Error("anchor_proposal_confidence_too_low");
        }
        const proposalPath = resolveProposalPath(proposal.id);
        const initialStatus = (proposal.riskFlags && proposal.riskFlags.length > 0) ? "requires_review" : "draft";
        await writeCanonicalArtifact(proposalPath, renderProposal(proposal));
        await this.proposalRepository.create({
            id: proposal.id,
            targetAssetId: proposal.targetAssetId,
            beforeHash: proposal.beforeHash ?? null,
            afterHash: proposal.afterHash ?? null,
            status: initialStatus,
            proposedDiff: proposal.proposedDiff,
            reason: proposal.reason,
            supportingSources: JSON.stringify(proposal.supportingSources),
            confidence: proposal.confidence,
            createdAt: proposal.createdAt ?? new Date().toISOString(),
        });
        if (proposal.supportingSources.length > 0) {
            await this.provenanceRepository.linkEntrySources(proposal.id, proposal.supportingSources);
        }
        return { proposalId: proposal.id, proposalPath, status: initialStatus };
    }
    async applyGovernedAnchorWrite(proposalId) {
        const proposal = await this.proposalRepository.findById(proposalId);
        if (!proposal) {
            throw new Error("proposal_not_found");
        }
        if (proposal.status !== "approved") {
            throw new Error("proposal_not_approved");
        }
        const target = await this.assetRepository.findById(proposal.targetAssetId);
        if (!target) {
            throw new Error("target_asset_not_found");
        }
        const beforeContent = await readText(target.path);
        const beforeHash = await hashFile(target.path);
        if (proposal.beforeHash && proposal.beforeHash !== beforeHash) {
            await this.proposalRepository.updateStatus(proposalId, "conflicted");
            throw new Error("anchor_proposal_conflict");
        }
        const nextContent = applyDiff(beforeContent, proposal.proposedDiff);
        await writeCanonicalArtifact(target.path, nextContent);
        const hash = await hashFile(target.path);
        await this.assetRepository.upsert({
            ...target,
            hash,
            version: target.version + 1,
            lastIndexedAt: new Date().toISOString(),
        });
        await this.proposalRepository.updateStatus(proposalId, "applied", hash);
        await this.provenanceRepository.recordApply(proposalId, target.id, {
            beforeHash,
            afterHash: hash,
            diff: proposal.proposedDiff,
        });
        return { applied: true, assetId: target.id, hash };
    }
    async approveProposal(proposalId) {
        await this.proposalRepository.updateStatus(proposalId, "approved");
    }
    async rejectProposal(proposalId) {
        await this.proposalRepository.updateStatus(proposalId, "rejected");
    }
    async loadProposal(proposalId) {
        const record = await this.proposalRepository.findById(proposalId);
        if (!record)
            return null;
        return {
            id: record.id,
            targetAssetId: record.targetAssetId,
            beforeHash: record.beforeHash ?? undefined,
            afterHash: record.afterHash ?? undefined,
            status: record.status,
            proposedDiff: record.proposedDiff,
            reason: record.reason,
            supportingSources: JSON.parse(record.supportingSources),
            confidence: record.confidence,
            createdAt: record.createdAt,
        };
    }
}
export function createGovernanceLayer(database) {
    return new GovernanceLayer(new ProposalRepository(database), new AssetRepository(database), new ProvenanceRepository(database));
}
