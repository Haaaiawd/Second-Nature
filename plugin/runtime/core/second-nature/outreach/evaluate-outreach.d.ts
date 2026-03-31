import type { OutreachEvaluationInput, OutreachEvaluationResult } from "../../../shared/types/outreach.js";
export interface OutreachModelAssistPort {
    evaluateOutreachCandidate(input: OutreachEvaluationInput): Promise<OutreachEvaluationResult>;
}
export interface OutreachPolicyConfig {
    minThreshold: number;
}
export interface OutreachGateResult {
    allowed: boolean;
    reasonCodes: string[];
    evaluation: OutreachEvaluationResult;
}
export declare function evaluateOutreach(model: OutreachModelAssistPort, input: OutreachEvaluationInput, policy?: Partial<OutreachPolicyConfig>): Promise<OutreachGateResult>;
