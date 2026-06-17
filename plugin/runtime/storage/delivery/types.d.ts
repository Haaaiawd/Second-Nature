/**
 * Delivery attempt persistence (state-system v5 / T4.3.1).
 *
 * Boundaries: validates proof fields before index write; hostProofRef uses SourceRef JSON.
 * Test coverage: tests/unit/storage/delivery-attempt.test.ts
 */
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
export type DeliveryAttemptStatus = "sent" | "failed" | "dropped_by_host_policy";
export interface DeliveryAttemptWrite {
    attemptId: string;
    decisionId: string;
    target?: "none" | "last" | "explicit";
    channel?: string;
    status: DeliveryAttemptStatus;
    messageId?: string;
    hostProofRef?: LifeEvidenceSourceRef;
    errorClass?: string;
    fallbackRef?: string;
}
export interface DeliveryAttemptRecord extends DeliveryAttemptWrite {
    createdAt: string;
}
export interface DeliveryAttemptAck {
    attemptId: string;
    status: DeliveryAttemptStatus;
    fallbackRef?: string;
}
