import type { SourceRef } from "../life-evidence/types.js";
export type OperatorFallbackReason = "target_none" | "channel_missing" | "host_unsupported" | "delivery_failed";
export interface OperatorFallbackWrite {
    reason: OperatorFallbackReason;
    decisionId: string;
    sourceRefs: SourceRef[];
    candidateMessage?: string;
    nextStep: string;
}
