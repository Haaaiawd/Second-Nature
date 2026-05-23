/**
 * BehaviorPromotionLoop — T-BTS.C.3
 *
 * Core logic: Operator-authorized behavior suggestion lifecycle.
 * - candidate → approved (idempotent: repeated approve returns existing)
 * - candidate → rejected (with reason)
 * - candidate → expired (7 days TTL from submission)
 * - rejected/expired are read-only; new submit creates a fresh candidate
 *
 * Dependencies:
 * - `StateDatabase` from `../../../../storage/db/index.js`
 *
 * Boundary:
 * - Does NOT grant execution authorization; approval is a bookkeeping signal.
 * - Only accepts operator-authorized suggestions, not connector auto-probe results.
 *
 * Test coverage: tests/unit/body/behavior-promotion-loop.test.ts
 */
import type { StateDatabase } from "../../../../storage/db/index.js";
export type PromotionStatus = "candidate" | "approved" | "rejected" | "expired";
export interface BehaviorPromotion {
    promotionId: string;
    behaviorKind: string;
    description: string;
    status: PromotionStatus;
    operatorId?: string;
    rejectReason?: string;
    submittedAt: string;
    decidedAt?: string;
    expiresAt: string;
}
export interface BehaviorPromotionLoop {
    submitPromotion(input: {
        promotionId: string;
        behaviorKind: string;
        description: string;
        operatorId?: string;
    }): Promise<BehaviorPromotion>;
    approvePromotion(promotionId: string): Promise<BehaviorPromotion>;
    rejectPromotion(promotionId: string, reason: string): Promise<BehaviorPromotion>;
    loadPromotion(promotionId: string): Promise<BehaviorPromotion | undefined>;
    listPromotions(status?: PromotionStatus): Promise<BehaviorPromotion[]>;
    expireStaleCandidates(): Promise<number>;
}
export declare function createBehaviorPromotionLoop(database: StateDatabase): BehaviorPromotionLoop;
