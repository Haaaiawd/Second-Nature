import type { CandidateIntent } from "../types.js";
import type { SourceRef } from "../../../shared/types/v8-contracts.js";
import { type DeliveryCapabilitySnapshot, type DeliveryTargetResolution } from "./delivery-target.js";
export type OutreachJudgmentVerdict = "allow" | "deny" | "defer";
export type CooldownState = "clear" | "cooling_down" | "duplicate";
export interface JudgeOutreachUserInterest {
    staleness: "fresh" | "stale" | "insufficient";
    confidence: number;
    signals: Array<{
        topic: string;
        confidence: number;
        sourceRefs: SourceRef[];
    }>;
    sourceRefs: SourceRef[];
}
export interface JudgeOutreachLifeEvidence {
    empty: boolean;
    evidenceRefCount: number;
}
export interface JudgeOutreachInput {
    candidate: CandidateIntent;
    userInterest: JudgeOutreachUserInterest;
    lifeEvidence: JudgeOutreachLifeEvidence;
    delivery: DeliveryCapabilitySnapshot;
    duplicateBlocked?: boolean;
    cooldownBlocked?: boolean;
}
export interface OutreachJudgment {
    decisionId: string;
    candidateId: string;
    verdict: OutreachJudgmentVerdict;
    valueScore: number;
    userRelevance: number;
    actionability: number;
    interestRefs: SourceRef[];
    sourceRefs: SourceRef[];
    cooldownState: CooldownState;
    deliveryVerdict: DeliveryTargetResolution["verdict"];
    reasons: string[];
}
export declare function judgeOutreach(input: JudgeOutreachInput): OutreachJudgment;
