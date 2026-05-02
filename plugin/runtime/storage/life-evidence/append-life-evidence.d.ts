import type { StateDatabase } from "../db/index.js";
import type { ProvenanceRepository } from "../repositories/provenance-repository.js";
import type { LifeEvidenceCandidate, LifeEvidenceWriteAck } from "./types.js";
export interface AppendLifeEvidenceOptions {
    provenance?: ProvenanceRepository;
}
export declare function appendLifeEvidence(state: StateDatabase, workspaceRoot: string, candidate: LifeEvidenceCandidate, options?: AppendLifeEvidenceOptions): Promise<LifeEvidenceWriteAck>;
