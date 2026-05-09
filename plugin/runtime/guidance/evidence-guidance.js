export function buildEvidencePack(refs, opts) {
    const policy = opts?.policy ?? "strict";
    const unresolvedIds = [];
    let sensitiveBlocked = false;
    const grounded = [];
    for (const r of refs) {
        if (!r.uri?.trim()) {
            unresolvedIds.push(r.id);
            continue;
        }
        if (r.uri.includes("credential") || r.uri.includes("secret")) {
            sensitiveBlocked = true;
            continue;
        }
        grounded.push(r);
    }
    if (policy === "strict" && unresolvedIds.length > 0) {
        return { ok: false, reasons: ["unresolved_source_refs", ...unresolvedIds.slice(0, 3)] };
    }
    return {
        ok: true,
        pack: {
            groundedRefs: grounded,
            unresolvedIds,
            sensitiveBlocked,
            policy,
        },
    };
}
export function selectInterestBasis(input) {
    if (input.staleness === "insufficient" || input.confidence < 0.15) {
        return input.signalCount > 0 ? "evidence_only" : "unavailable";
    }
    if (input.staleness === "stale") {
        return "evidence_only";
    }
    return "interest_augmented";
}
export function buildQuietNarrativeGuidance(input) {
    if (input.interestBasis === "unavailable" && input.sourceCoverage.coverageRatio < 0.25) {
        return { status: "unavailable", reasons: ["quiet_guidance_insufficient_interest_and_coverage"] };
    }
    if (input.sourceCoverage.unsupportedClaims.length > 0) {
        return { status: "unavailable", reasons: ["quiet_guidance_unsupported_claims"] };
    }
    const hints = [
        ...input.outline.slice(0, 3).map((line) => `hint:${line}`),
        `basis:${input.interestBasis}`,
        `coverage:${input.sourceCoverage.coverageRatio.toFixed(2)}`,
    ];
    return { status: "ready", hints };
}
