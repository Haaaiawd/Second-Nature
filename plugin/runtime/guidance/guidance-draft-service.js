/**
 * GuidanceDraftService — T-GVS.C.1
 *
 * Core logic: source-backed draft generation with delivery-time re-validation.
 * Implements DR-028 (validateDraftSources) and DR-030 (GuidanceDraftRequest 7-field contract).
 *
 * Boundary:
 * - Generates DraftMessage with source_refs traced to evidence pack claims.
 * - validateDraftSources checks evidence availability before delivery; marks invalid
 *   if any source has been redacted or deleted, returning `draft_source_invalidated`.
 * - Does not own delivery; caller must validate before sending.
 *
 * Test coverage: tests/unit/guidance/guidance-draft-service.test.ts
 */
// ─── Service ────────────────────────────────────────────────────────────────
const SCENE_KINDS = [
    "outreach",
    "follow_up",
    "reconnect",
];
function buildDraftText(request, claims) {
    const anchor = claims.map((c) => c.text).join("; ");
    switch (request.sceneKind) {
        case "outreach":
            return `Hi there — wanted to share something that came up: ${anchor}`;
        case "follow_up":
            return `Following up on what we talked about: ${anchor}`;
        case "reconnect":
            return `It's been a while — here's what caught my attention: ${anchor}`;
        default:
            return `Draft for ${request.sceneKind}: ${anchor}`;
    }
}
export async function generateGuidanceDraft(request, deps) {
    if (!SCENE_KINDS.includes(request.sceneKind)) {
        return { error: "unsupported_scene_kind" };
    }
    const pack = await deps.evidencePort.loadEvidencePack(request.evidencePackRef);
    if (!pack) {
        return { error: "evidence_pack_unavailable" };
    }
    const allSourceRefs = pack.claims.flatMap((c) => c.sourceRefs);
    if (allSourceRefs.length === 0) {
        return { error: "draft_source_invalidated" };
    }
    const text = buildDraftText(request, pack.claims);
    const parts = [
        `evidencePack=${request.evidencePackRef}`,
        `relationshipContext=${request.relationshipContextRef}`,
    ];
    if (request.channelHint) {
        parts.push(`channel=${request.channelHint}`);
    }
    if (request.ownerPreferenceRef) {
        parts.push(`ownerPreference=${request.ownerPreferenceRef}`);
    }
    return {
        draft: {
            text,
            deliveryWording: "sendable",
            sourceRefs: allSourceRefs,
            explanation: parts.join("; "),
        },
    };
}
export async function validateDraftSources(draft, deps) {
    const results = await Promise.all(draft.sourceRefs.map(async (ref) => ({
        ref,
        available: await deps.validatorPort.checkSourceAvailable(ref),
    })));
    const firstInvalid = results.find((r) => !r.available);
    if (firstInvalid) {
        return {
            valid: false,
            invalidated: true,
            reason: "draft_source_invalidated",
        };
    }
    return { valid: true };
}
