import type { ObservabilityDatabase } from "../db/index.js";
import type { AnchorChangeAudit } from "../../shared/types/continuity.js";
export interface CredentialLifecycleAudit {
    id: string;
    platformId: string;
    credentialId: string;
    statusFrom?: string;
    statusTo: string;
    verificationDeadline?: string;
    attemptsRemaining?: number;
    explanationCapsule: string;
    createdAt: string;
}
export declare class GovernanceAudit {
    private db;
    constructor(db: ObservabilityDatabase);
    recordAnchorChangeAudit(event: AnchorChangeAudit): Promise<void>;
    recordCredentialLifecycle(event: CredentialLifecycleAudit): Promise<void>;
    recordProposalApply(proposalId: string, targetAssetId: string, assetPath: string, beforeHash: string | undefined, afterHash: string | undefined, supportingSources: string[], reason: string): Promise<void>;
    recordProposalReject(proposalId: string, targetAssetId: string, assetPath: string, reason: string): Promise<void>;
    queryByProposalId(proposalId: string): Promise<AnchorChangeAudit[]>;
    queryByAssetId(assetId: string): Promise<AnchorChangeAudit[]>;
    queryByEventType(eventType: string): Promise<AnchorChangeAudit[]>;
    queryCredentialByPlatform(platformId: string): Promise<CredentialLifecycleAudit[]>;
    private mapToAnchorAudit;
    private mapToCredentialAudit;
}
