import type { DecisionRecord, ExecutionAttempt } from "../../shared/types/continuity.js";
export interface GovernanceEvidenceRecord {
    id: string;
    eventType: string;
    proposalId?: string;
    targetAssetId?: string;
    assetPath?: string;
    statusFrom?: string;
    statusTo: string;
    beforeHash?: string;
    afterHash?: string;
    supportingSources: string[];
    reason?: string;
    verificationDeadline?: string;
    attemptsRemaining?: number;
    createdAt: string;
}
export interface ResolvedContentRef {
    ref: string;
    resolved: boolean;
    content?: string;
}
export interface EvidenceResolutionPlan {
    path: string[];
    key: "decisionId" | "traceId" | "assetId" | "proposalId" | "sessionId";
}
export interface EvidenceQuery {
    decisionId?: string;
    traceId?: string;
    assetId?: string;
    proposalId?: string;
    sessionId?: string;
    includeContentRefs?: boolean;
}
export interface ExplanationCapsule {
    conclusion: string;
    keyFactors: string[];
    evidenceRefs: string[];
}
export interface EvidenceBundle {
    query: EvidenceQuery;
    plan: EvidenceResolutionPlan;
    decisions: DecisionRecord[];
    attempts: ExecutionAttempt[];
    governance: GovernanceEvidenceRecord[];
    resolvedContentRefs: ResolvedContentRef[];
    explanation: ExplanationCapsule;
}
export declare function composeEvidenceBundle(input: {
    query: EvidenceQuery;
    plan: EvidenceResolutionPlan;
    decisions: DecisionRecord[];
    attempts: ExecutionAttempt[];
    governance: GovernanceEvidenceRecord[];
    resolvedContentRefs: ResolvedContentRef[];
}): EvidenceBundle;
