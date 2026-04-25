export function projectReflectionAudit(input) {
    return {
        eventId: input.id,
        unsupportedClaimCount: input.unsupportedClaimCount,
        sourceCoverageRatio: input.sourceCoverageRatio,
        claimCount: input.claimCount,
        modelEvalRef: input.modelEvalRef,
    };
}
