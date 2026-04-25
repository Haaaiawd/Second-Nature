/**
 * Build a ContinuitySnapshot from loaded inputs.
 *
 * In production, inputs come from state-system (mode, budgets, obligations),
 * workspace (outreach hashes, denied intents), and runtime context (window ID).
 */
export function buildContinuitySnapshot(inputs) {
    return {
        mode: inputs.mode,
        currentWindowId: inputs.currentWindowId,
        pendingObligations: inputs.pendingObligations,
        recentOutreachHashes: inputs.recentOutreachHashes,
        deniedIntents: inputs.deniedIntents,
        budgets: inputs.budgets,
        awaitingUserInput: inputs.awaitingUserInput,
        riskSuppressed: inputs.riskSuppressed,
    };
}
