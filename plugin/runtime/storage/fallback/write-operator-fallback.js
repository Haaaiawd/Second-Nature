/**
 * Persists operator-visible delivery fallback artifacts (T2.3.2 / state-system v5).
 * status is always not_sent per ADR-007.
 */
import * as crypto from "node:crypto";
import { operatorFallbackArtifacts } from "../db/schema/operator-fallback-artifacts.js";
export async function writeOperatorFallback(state, input) {
    const fallbackRef = `fallback:${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    await state.db.insert(operatorFallbackArtifacts).values({
        fallbackRef,
        decisionId: input.decisionId,
        status: "not_sent",
        reason: input.reason,
        sourceRefsJson: JSON.stringify(input.sourceRefs),
        candidateMessage: input.candidateMessage ?? null,
        nextStep: input.nextStep,
        createdAt,
    });
    return { fallbackRef };
}
