import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
import type { OperatorFallbackReason } from "./operator-fallback-types.js";
/** Operator-facing delivery fallback (T1.2.2 / cli-system v5). Status is always not_sent — never sent/delivered. */
export interface OperatorFallbackView {
    fallbackRef: string;
    reason: OperatorFallbackReason | string;
    status: "not_sent";
    sourceRefs: LifeEvidenceSourceRef[];
    candidateMessage?: string;
    nextStep: string;
}
