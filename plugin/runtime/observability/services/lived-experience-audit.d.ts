import { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
import type { SourceRef } from "../../storage/life-evidence/types.js";
import type { DreamTrace } from "../../dream/types.js";
export type RuntimeScope = "rhythm" | "user_task" | "user_reply";
export type HeartbeatOutcome = "heartbeat_ok" | "intent_selected" | "denied" | "deferred" | "runtime_carrier_only" | "delivery_unavailable";
export type DeliveryAuditStatus = "not_requested" | "target_available" | "target_none" | "channel_missing" | "host_unsupported" | "ack_dropped" | "sent" | "failed" | "not_sent_fallback";
export type GroundingStatus = "pass" | "degraded" | "blocked";
export interface DecisionTracePayload {
    decisionId: string;
    traceId: string;
    heartbeatId?: string;
    runtimeScope: RuntimeScope;
    outcome: HeartbeatOutcome;
    selectedIntentId?: string;
    candidateId?: string;
    rhythmWindowKind?: string;
    hardGuardVerdict?: "allow" | "deny" | "defer" | "silent";
    outreachVerdict?: "allow" | "deny" | "defer";
    deliveryAuditId?: string;
    reasonCodes: string[];
    sourceRefs: SourceRef[];
    snapshotRef?: SourceRef;
    createdAt: string;
}
export interface DeliveryAuditPayload {
    auditId: string;
    decisionId: string;
    traceId: string;
    target?: "none" | "last" | "explicit";
    channel?: string;
    recipientRef?: string;
    status: DeliveryAuditStatus;
    messageId?: string;
    hostProofRef?: SourceRef;
    fallbackRef?: string;
    ackDropMatched?: boolean;
    hostVersion?: string;
    reasonCodes: string[];
    createdAt: string;
}
export interface SourceCoverageAuditPayload {
    auditId: string;
    traceId: string;
    /** When set, explain index links this audit to the decision timeline. */
    decisionId?: string;
    subjectType: "quiet_artifact" | "outreach_draft" | "guidance_payload" | "decision_trace" | "host_report";
    subjectRef: string;
    usedSourceRefs: SourceRef[];
    unresolvedRefs: SourceRef[];
    coverageRatio: number;
    unsupportedClaims: string[];
    status: GroundingStatus;
    reasonCodes: string[];
    createdAt: string;
}
export interface GuidanceGroundingAuditPayload {
    auditId: string;
    traceId: string;
    decisionId?: string;
    requestId: string;
    draftId?: string;
    sceneType: "outreach" | "quiet_reflection" | "social" | "explain" | "user_reply_continuity" | "fallback_candidate";
    groundingStatus: GroundingStatus;
    usedSourceRefs: SourceRef[];
    unsupportedClaims: string[];
    guardViolations: string[];
    deliveryWording?: "sendable" | "not_sent_fallback_candidate";
    createdAt: string;
}
export interface NarrativeTracePayload {
    traceId: string;
    narrativeId: string;
    revision: number;
    updateSource: "heartbeat" | "dream" | "owner" | "maintenance";
    sourceRefs: Array<{
        id: string;
        kind: string;
        uri?: string;
    }>;
    unsupportedClaims: string[];
    groundingStatus: GroundingStatus;
    goalInfluenceRefs: string[];
    createdAt: string;
}
export interface ExplainLinkageSummary {
    decisionId: string;
    summary: string;
    warnings: string[];
    deliveryStatus?: DeliveryAuditStatus;
    relatedEventIds: string[];
}
export declare class LivedExperienceAuditRecorder {
    private readonly store;
    private seq;
    private readonly explainIndex;
    constructor(store: AppendOnlyAuditStore);
    private bumpSequence;
    private touchDecision;
    recordDecisionTrace(payload: DecisionTracePayload): {
        eventId: string;
    };
    recordDeliveryAudit(payload: DeliveryAuditPayload): {
        eventId: string;
    };
    recordSourceCoverage(payload: SourceCoverageAuditPayload): {
        eventId: string;
    };
    recordGuidanceGrounding(payload: GuidanceGroundingAuditPayload): {
        eventId: string;
    };
    recordNarrativeTrace(payload: NarrativeTracePayload): {
        eventId: string;
    };
    recordDreamTrace(payload: DreamTrace): {
        eventId: string;
    };
    explainLinkageForDecision(decisionId: string): ExplainLinkageSummary;
}
export declare function createLivedExperienceAuditRecorder(store?: AppendOnlyAuditStore): LivedExperienceAuditRecorder;
