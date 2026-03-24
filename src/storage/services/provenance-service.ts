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

export class ProvenanceService {
  constructor(
    private readonly provenanceRepository: ProvenanceRepository,
    private readonly proposalRepository: ProposalRepository,
    private readonly assetRepository: AssetRepository
  ) {}

  async explainProvenance(assetId: string): Promise<ProvenanceDetail> {
    const asset = await this.assetRepository.findById(assetId);
    const trace = await this.provenanceRepository.traceAsset(assetId);

    const proposals: ProvenanceDetail["proposals"] = [];
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

export function createProvenanceService(database: StateDatabase): ProvenanceService {
  return new ProvenanceService(
    new ProvenanceRepository(database),
    new ProposalRepository(database),
    new AssetRepository(database)
  );
}