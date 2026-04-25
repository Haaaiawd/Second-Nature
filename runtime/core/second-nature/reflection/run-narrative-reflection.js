export async function runNarrativeReflection(ports, input) {
    const quietInputs = await ports.loadQuietInputs({ lookbackDays: input.lookbackDays });
    const reflection = await ports.generateNarrativeReflection({
        sourceRefs: quietInputs.sourceRefs,
    });
    if (!reflection.summary || reflection.summary.trim().length === 0) {
        throw new Error("reflection_missing_summary");
    }
    if (!reflection.claims || reflection.claims.length === 0) {
        throw new Error("reflection_missing_claims");
    }
    const unsupportedClaimCount = reflection.claims.filter((claim) => claim.sourceRefs.length === 0).length;
    if (unsupportedClaimCount > 0) {
        throw new Error("reflection_unsupported_claims");
    }
    const coveredClaims = reflection.claims.filter((claim) => claim.sourceRefs.length > 0).length;
    const sourceCoverageRatio = coveredClaims / reflection.claims.length;
    const writes = ports.filterAllowedWrites(reflection.proposedWrites)
        .filter((write) => write.sourceRefs.length > 0);
    return {
        summary: reflection.summary,
        claims: reflection.claims,
        writes,
        sourceRefs: quietInputs.sourceRefs,
        modelEvalRef: reflection.modelEvalRef,
        unsupportedClaimCount,
        sourceCoverageRatio,
    };
}
