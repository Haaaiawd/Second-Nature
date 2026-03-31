import { ProvenanceRepository } from "../repositories/provenance-repository.js";
import { ProposalRepository } from "../repositories/proposal-repository.js";
import { AssetRepository } from "../repositories/asset-repository.js";
export class ProvenanceService {
    provenanceRepository;
    proposalRepository;
    assetRepository;
    constructor(provenanceRepository, proposalRepository, assetRepository) {
        this.provenanceRepository = provenanceRepository;
        this.proposalRepository = proposalRepository;
        this.assetRepository = assetRepository;
    }
    async explainProvenance(assetId) {
        const asset = await this.assetRepository.findById(assetId);
        const trace = await this.provenanceRepository.traceAsset(assetId);
        const proposals = [];
        for (const pid of trace.proposalIds) {
            const p = await this.proposalRepository.findById(pid);
            if (p) {
                proposals.push({
                    id: p.id,
                    status: p.status,
                    targetAssetId: p.targetAssetId,
                    proposedDiff: p.proposedDiff,
                    reason: p.reason,
                    confidence: p.confidence,
                    supportingSources: JSON.parse(p.supportingSources),
                });
            }
        }
        return {
            assetId,
            assetPath: asset?.path,
            assetHash: asset?.hash,
            assetVersion: asset?.version,
            provenance: trace,
            proposals,
        };
    }
}
export function createProvenanceService(database) {
    return new ProvenanceService(new ProvenanceRepository(database), new ProposalRepository(database), new AssetRepository(database));
}
