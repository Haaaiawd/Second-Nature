import type { ObservabilityDatabase } from "../db/index.js";
import { type EvidenceBundle, type EvidenceQuery, type EvidenceResolutionPlan } from "./compose-evidence.js";
interface ContentResolver {
    resolve(ref: string): Promise<string | undefined>;
}
export declare class EvidenceQueryEngine {
    private readonly db;
    private readonly contentResolver;
    constructor(db: ObservabilityDatabase, contentResolver?: ContentResolver);
    resolveEvidencePath(query: EvidenceQuery): EvidenceResolutionPlan;
    queryEvidence(query: EvidenceQuery): Promise<EvidenceBundle>;
    private loadDecisions;
    private loadAttempts;
    private loadGovernance;
    private resolveContentRefs;
}
export {};
