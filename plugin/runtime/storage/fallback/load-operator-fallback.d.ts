import type { StateDatabase } from "../db/index.js";
import type { LifeEvidenceSourceRef } from "../life-evidence/types.js";
import type { OperatorFallbackView } from "./operator-fallback-view.js";
export declare function normalizeFallbackRef(ref: string): string;
/** Loads persisted operator fallback row; does not coerce status (use `toOperatorFallbackView`). */
export declare function loadOperatorFallbackRow(state: StateDatabase, fallbackRef: string): Promise<{
    fallbackRef: string;
    reason: string;
    status: string;
    sourceRefs: LifeEvidenceSourceRef[];
    candidateMessage?: string;
    nextStep: string;
} | null>;
export declare function toOperatorFallbackView(row: NonNullable<Awaited<ReturnType<typeof loadOperatorFallbackRow>>>): OperatorFallbackView;
