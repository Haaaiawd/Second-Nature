/**
 * ChannelFeedbackIngestionService — T-GVS.C.2
 *
 * Core logic: process delivery result and owner reaction into RelationshipMemory;
 * retry with exponential backoff on persistence failure; audit on exhaustion.
 * Implements DR-029 (retry + audit; no silent loss) and ADR-006 (delivery truth).
 *
 * Boundary:
 * - Consumes ChannelFeedback from runtime-ops-system.
 * - Writes to state-memory-system via port (no direct DB access).
 * - On 3 failed retries, emits observability audit event (family: guidance.feedback_ingestion_failed)
 *   with feedback summary hash — never raw reaction content.
 * - Missing deliveryProof → deliveryResult coerced to "not_sent".
 *
 * Test coverage: tests/unit/guidance/channel-feedback-ingestion.test.ts
 */
export type DeliveryResult = "sent" | "failed" | "not_sent";
export type OwnerReaction = "reply" | "ignore" | "block" | "react";
export interface DeliveryProof {
    messageId?: string;
    hostProofRef?: string;
}
export interface ChannelFeedback {
    messageId?: string;
    deliveryResult: DeliveryResult;
    deliveryProof?: DeliveryProof;
    ownerReaction: OwnerReaction;
    reactionContent?: string;
    timestamp: string;
    channelId: string;
}
export interface RelationshipUpdate {
    channelId: string;
    timestamp: string;
    trustDelta: number;
    responsePattern: {
        reaction: OwnerReaction;
        timing: "immediate" | "delayed" | "very_delayed";
        tone: "positive" | "neutral" | "negative";
    };
    deliverySuccess: boolean;
}
export interface ResponsePatternEntry {
    reaction: OwnerReaction;
    timing: "immediate" | "delayed" | "very_delayed";
    tone: "positive" | "neutral" | "negative";
    observedAt: string;
}
export interface ChannelPreference {
    channelId: string;
    successRate: number;
    lastUsedAt?: string;
}
export interface RelationshipMemory {
    channelPreferences: ChannelPreference[];
    responsePatterns: ResponsePatternEntry[];
    trustDelta: number;
    lastUpdated?: string;
}
export interface StrategyAdjustment {
    type: "frequency" | "tone" | "timing";
    adjustment: string;
    reason: string;
    value?: number;
}
export interface FeedbackIngestionResult {
    status: "ingested" | "rejected" | "failed_after_retries";
    relationshipUpdate?: RelationshipUpdate;
    strategyAdjustments?: StrategyAdjustment[];
    updatedTrust?: number;
}
export interface RelationshipMemoryPort {
    loadRelationshipMemory(): Promise<RelationshipMemory>;
    updateRelationshipMemory(update: RelationshipMemory): Promise<void>;
}
export interface FeedbackAuditPort {
    recordFeedbackIngestionFailed(summary: {
        feedbackId: string;
        channelId: string;
        summaryHash: string;
        retryCount: number;
    }): Promise<void>;
}
export declare function ingestChannelFeedback(feedback: ChannelFeedback, deps: {
    relationshipPort: RelationshipMemoryPort;
    auditPort: FeedbackAuditPort;
}): Promise<FeedbackIngestionResult>;
