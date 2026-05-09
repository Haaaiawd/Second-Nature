export class OperatorFallbackNotFoundError extends Error {
    ref;
    code = "FALLBACK_NOT_FOUND";
    constructor(ref) {
        super(`No operator fallback artifact for ref: ${ref}`);
        this.ref = ref;
        this.name = "OperatorFallbackNotFoundError";
    }
}
/**
 * T1.2.2 — Operator-visible fallback: always `status: not_sent` (ADR-007), never sent/delivered.
 */
export async function showOperatorFallback(ref, readModels) {
    const view = await readModels.loadFallbackView(ref);
    if (!view) {
        throw new OperatorFallbackNotFoundError(ref.trim());
    }
    return {
        ...view,
        status: "not_sent",
    };
}
