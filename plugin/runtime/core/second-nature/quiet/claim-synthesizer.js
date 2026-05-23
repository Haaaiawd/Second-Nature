/**
 * ClaimSynthesizer — T-DQS.C.1
 *
 * Core logic: Transform aggregated life evidence into source-backed QuietClaims.
 * - EvidenceAggregator: group and summarize raw evidence candidates
 * - ClaimDeduplicator: remove duplicate claims by sourceRef key
 * - ClaimSynthesizer: map evidence -> claim kind (observation/fact/pattern)
 * - SourceValidator: reject fact claims with empty sourceRefs (DR-025)
 *
 * Rules:
 * - Single weak evidence (confidence < 0.5, count == 1) → observation only
 * - Multiple evidence or confidence >= 0.5 → fact
 * - Pattern requires >= 3 related evidence with confidence >= 0.7
 * - Fact claim sourceRefs must be non-empty tuple (DR-025)
 * - SourceValidator returns claim_source_missing for empty sourceRefs
 *
 * Dependencies:
 * - `QuietClaim`, `QuietClaimKind` from `../../../shared/types/v7-entities.js`
 * - `LifeEvidenceCandidate` from `../../../storage/life-evidence/types.js`
 *
 * Test coverage: tests/unit/quiet/claim-synthesizer.test.ts
 */
// ── EvidenceAggregator ───────────────────────────────────────
export function createEvidenceAggregator() {
    return {
        aggregate(candidates) {
            // Group by evidenceType for summary
            const byType = new Map();
            for (const c of candidates) {
                const list = byType.get(c.evidenceType) ?? [];
                list.push(c);
                byType.set(c.evidenceType, list);
            }
            const parts = [];
            for (const [type, list] of byType) {
                parts.push(`${list.length} ${type}`);
            }
            return {
                items: candidates,
                summary: parts.join("; ") || "empty",
            };
        },
    };
}
// ── ClaimDeduplicator ────────────────────────────────────────
function sourceRefKey(claim) {
    return [...claim.sourceRefs].sort().join("|");
}
export function createClaimDeduplicator() {
    return {
        deduplicate(claims) {
            const seen = new Set();
            const result = [];
            for (const claim of claims) {
                const key = sourceRefKey(claim);
                if (seen.has(key))
                    continue;
                seen.add(key);
                result.push(claim);
            }
            return result;
        },
    };
}
// ── ClaimSynthesizer ─────────────────────────────────────────
function determineKind(items, avgConfidence) {
    if (items.length >= 3 && avgConfidence >= 0.7) {
        return "pattern";
    }
    return "fact";
}
function buildText(kind, summary, count) {
    switch (kind) {
        case "observation":
            return `Observed: ${summary}`;
        case "fact":
            return `Noted ${count} evidence(s): ${summary}`;
        case "pattern":
            return `Pattern detected across ${count} sources: ${summary}`;
    }
}
function toSourceRefTuple(refs) {
    const ids = refs.map((r) => r.id).filter((id) => id && id.trim().length > 0);
    if (ids.length === 0) {
        // This should not happen if validation is correct, but type-safety requires it
        return ["synthetic://missing"];
    }
    return ids;
}
export function createClaimSynthesizer() {
    return {
        synthesize(slice) {
            const claims = [];
            const errors = [];
            const now = new Date().toISOString();
            if (slice.items.length === 0) {
                return { claims: [], errors: [] };
            }
            // Group by evidenceType for per-group synthesis
            const byType = new Map();
            for (const item of slice.items) {
                const list = byType.get(item.evidenceType) ?? [];
                list.push(item);
                byType.set(item.evidenceType, list);
            }
            for (const [evidenceType, items] of byType) {
                const avgConfidence = items.reduce((sum, i) => sum + (i.confidence ?? 0), 0) /
                    items.length;
                let kind = determineKind(items, avgConfidence);
                // Single weak evidence → observation only (no fact/pattern)
                if (items.length === 1 && (items[0].confidence ?? 0) < 0.5) {
                    if (kind !== "observation") {
                        errors.push(`weak_evidence_downgrade:${evidenceType}:${kind}_to_observation`);
                    }
                    kind = "observation";
                }
                const summary = items.map((i) => i.summary).join("; ");
                const text = buildText(kind, summary, items.length);
                const sourceRefs = toSourceRefTuple(items.map((i) => ({ id: i.id ?? i.summary, uri: i.sourceRefs[0]?.uri ?? "" })));
                claims.push({
                    claimId: `claim:${evidenceType}:${Date.now()}:${items.length}`,
                    kind,
                    text,
                    sourceRefs,
                    confidence: Math.min(avgConfidence, 1),
                    createdAt: now,
                });
            }
            return { claims, errors };
        },
    };
}
// ── SourceValidator ──────────────────────────────────────────
export function createSourceValidator() {
    return {
        validate(claim) {
            // All claim kinds require non-empty sourceRefs (DR-025)
            if (claim.sourceRefs.length === 0) {
                return { ok: false, reason: "claim_source_missing" };
            }
            for (const ref of claim.sourceRefs) {
                if (!ref || ref.trim().length === 0) {
                    return { ok: false, reason: "claim_source_missing" };
                }
                // Reject synthetic fallback refs (defensive: should not reach here)
                if (ref.startsWith("synthetic://")) {
                    return { ok: false, reason: "claim_source_missing" };
                }
            }
            return { ok: true };
        },
    };
}
