/**
 * Maps normalized connector success results to `LifeEvidenceCandidate` (T3.1.2).
 * Returns null when evidence cannot be source-backed (no refs, wrong intent, or failure).
 */
import type { CapabilityIntent, ConnectorResult } from "./contract.js";
import type { LifeEvidenceCandidate, Sensitivity } from "../../storage/life-evidence/types.js";
/**
 * Produce a single life-evidence candidate from a connector outcome, or null if not mappable.
 */
export declare function mapLifeEvidence(input: {
    platformId: string;
    intent: CapabilityIntent;
    result: ConnectorResult<unknown>;
    observedAt?: string;
    sensitivityOverride?: Sensitivity;
}): LifeEvidenceCandidate | null;
