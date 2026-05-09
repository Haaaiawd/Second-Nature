import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";
export declare class OperatorFallbackNotFoundError extends Error {
    readonly ref: string;
    readonly code: "FALLBACK_NOT_FOUND";
    constructor(ref: string);
}
export interface ShowOperatorFallbackReadModels {
    loadFallbackView(ref: string): Promise<OperatorFallbackView | null>;
}
/**
 * T1.2.2 — Operator-visible fallback: always `status: not_sent` (ADR-007), never sent/delivered.
 */
export declare function showOperatorFallback(ref: string, readModels: ShowOperatorFallbackReadModels): Promise<OperatorFallbackView>;
