/**
 * OutreachStrategySelector — T-GVS.C.3
 *
 * Core logic: select expression frequency, phrasing style and fallback copy
 * based on RelationshipMemory; apply DR-031 language quality lint (3 rules).
 * style_lint_failed is a degraded marker — it never blocks delivery.
 * fallback copy always has information value (not empty string).
 *
 * DR-031 lint rules:
 *   1. no_dry_filler   — no hollow phrases ("reach out", "touch base", "just checking in", etc.)
 *   2. anchored        — must contain a concrete source anchor (specific fact/observation reference)
 *   3. no_over_explain — no excessive qualifications (≥3 hedge phrases in one draft)
 *
 * Boundary:
 * - Reads RelationshipMemory (channelPreferences, responsePatterns, trustDelta).
 * - Does NOT write state; returns OutreachStrategy recommendation only.
 * - style_lint checks run on draft text passed in; strategy selection itself is rule-based.
 *
 * Test coverage:
 *   tests/unit/guidance/outreach-strategy-selector.test.ts
 *   tests/unit/guidance/outreach-style-fixtures.test.ts
 */
// ─── Constants ───────────────────────────────────────────────────────────────
/** DR-031: hollow filler phrases that indicate "dry/plain" copy */
const DRY_FILLER_PATTERNS = [
    /\bjust checking in\b/i,
    /\breach(?:ing)? out\b/i,
    /\btouch(?:ing)? base\b/i,
    /\bcircle(?:ing)? back\b/i,
    /\bfollowing up\b/i,
    /\bhoping (?:this|to)\b/i,
    /\b没什么特别的\b/,
    /\b只是想聊聊\b/,
    /\b随便问问\b/,
];
/** DR-031: patterns that signal a concrete anchor is present */
const ANCHOR_PATTERNS = [
    /\b(?:because|since|given that|based on|after|when|you (?:said|mentioned|shared|noted))\b/i,
    /\b(?:上次|你说|你提到|你分享|你提过|基于|根据|因为|之后|在.*之后)\b/,
    /\[.*?\]/, // inline reference bracket
    /\[ref:/i, // explicit source ref notation
];
/** DR-031: hedge phrases that over-explain */
const HEDGE_PHRASES = [
    /\bnot sure if\b/i,
    /\bperhaps\b/i,
    /\bmaybe\b/i,
    /\bpossibly\b/i,
    /\bif that makes sense\b/i,
    /\bi (?:don't|do not) know if\b/i,
    /\bi could be wrong\b/i,
    /\b也许\b/,
    /\b可能\b/,
    /\b说不定\b/,
    /\b不确定\b/,
    /\b不知道是否\b/,
];
const HEDGE_THRESHOLD = 3; // ≥3 in one draft → over_explain
/** Trust thresholds for frequency selection */
const TRUST_MINIMAL = -0.4;
const TRUST_REDUCED = -0.1;
/** No-reply signal: if ≥ this ratio of recent patterns are "ignore", reduce frequency */
const NO_REPLY_RATIO_THRESHOLD = 0.5;
const RECENT_PATTERNS_WINDOW = 5;
// ─── Language Quality Lint (DR-031) ─────────────────────────────────────────
/**
 * Run DR-031 language quality checklist on a draft text.
 * Returns StyleLintResult. style_lint_failed is a degraded marker — never blocks delivery.
 */
export function runStyleLint(draftText) {
    const violations = [];
    const hitRules = [];
    // Rule 1: no_dry_filler
    const hasDryFiller = DRY_FILLER_PATTERNS.some((p) => p.test(draftText));
    if (hasDryFiller) {
        violations.push({
            rule: "no_dry_filler",
            description: "Draft contains hollow filler phrases (e.g. 'just checking in', 'reach out'). Replace with source-backed opener.",
        });
        hitRules.push("no_dry_filler");
    }
    // Rule 2: anchored — must have at least one concrete anchor
    const hasAnchor = ANCHOR_PATTERNS.some((p) => p.test(draftText));
    if (!hasAnchor) {
        violations.push({
            rule: "anchored",
            description: "Draft lacks a concrete source anchor. Every claim should trace to observed evidence.",
        });
        hitRules.push("anchored");
    }
    // Rule 3: no_over_explain — count hedge phrase matches
    const hedgeCount = HEDGE_PHRASES.reduce((acc, p) => {
        const matches = draftText.match(new RegExp(p.source, p.flags + "g"));
        return acc + (matches ? matches.length : 0);
    }, 0);
    if (hedgeCount >= HEDGE_THRESHOLD) {
        violations.push({
            rule: "no_over_explain",
            description: `Draft contains ${hedgeCount} hedge phrases (threshold: ${HEDGE_THRESHOLD}). Remove qualifications unsupported by evidence.`,
        });
        hitRules.push("no_over_explain");
    }
    const passed = violations.length === 0;
    return {
        passed,
        violations,
        lintStatus: passed ? "passed" : "style_lint_failed",
        hitRules,
    };
}
// ─── Fallback Copy Builder ───────────────────────────────────────────────────
/**
 * Build channel-safe fallback copy that always has information value (DR-031 G4).
 * Never returns empty string. Includes sourceRefs anchor and human-readable channel reason.
 */
export function buildFallbackCopy(ctx) {
    const anchor = ctx.sourceRefs.length > 0 ? ctx.sourceRefs[0] : undefined;
    // Construct informative text — not just a status message
    let text;
    if (anchor) {
        text = `[channel-safe] Based on ${anchor}: ${ctx.reason}`;
    }
    else {
        text = `[channel-safe] ${ctx.reason}`;
    }
    // Ensure the text contains an unsupported-claim-free, factual statement
    const channelSafeReason = `Delivery currently unavailable via ${ctx.channelId ?? "this channel"}. ${ctx.reason}`;
    return {
        text,
        hasInformationValue: true,
        sourceAnchor: anchor,
        channelSafeReason,
    };
}
// ─── Strategy Selection ──────────────────────────────────────────────────────
/**
 * Compute outreach frequency from RelationshipMemory.
 * - noReply signals: if ≥50% of last 5 patterns are "ignore" → reduce frequency
 * - trustDelta: negative trust pushes toward minimal/paused
 */
export function computeFrequency(memory) {
    const recent = memory.responsePatterns.slice(-RECENT_PATTERNS_WINDOW);
    const noReplyCount = recent.filter((p) => p.reaction === "ignore" || p.reaction === "block").length;
    const noReplyRatio = recent.length > 0 ? noReplyCount / recent.length : 0;
    // Block reaction → always paused regardless of trust
    const hasBlock = memory.responsePatterns.some((p) => p.reaction === "block");
    if (hasBlock)
        return "paused";
    // Trust-based floor
    if (memory.trustDelta <= TRUST_MINIMAL)
        return "minimal";
    if (memory.trustDelta <= TRUST_REDUCED)
        return "reduced";
    // No-reply signal override
    if (noReplyRatio >= NO_REPLY_RATIO_THRESHOLD && recent.length >= 2)
        return "reduced";
    return "standard";
}
/**
 * Compute phrasing style from RelationshipMemory.
 * - positive tone patterns → warm_anchored
 * - neutral or mixed → concise_factual
 * - degraded trust / mostly negative → light_check
 */
export function computeStyle(memory, frequency) {
    if (frequency === "paused" || frequency === "minimal")
        return "light_check";
    const recent = memory.responsePatterns.slice(-RECENT_PATTERNS_WINDOW);
    const positiveCount = recent.filter((p) => p.tone === "positive").length;
    const negativeCount = recent.filter((p) => p.tone === "negative").length;
    if (positiveCount > negativeCount && positiveCount >= 2)
        return "warm_anchored";
    if (negativeCount > positiveCount)
        return "light_check";
    return "concise_factual";
}
/**
 * Compute rationale string summarising why this strategy was chosen.
 * Used for transparency / explain bundle — not for delivery copy.
 */
function buildRationale(memory, frequency, style) {
    const parts = [];
    parts.push(`trust_delta=${memory.trustDelta.toFixed(2)}`);
    parts.push(`patterns=${memory.responsePatterns.length}`);
    const hasBlock = memory.responsePatterns.some((p) => p.reaction === "block");
    if (hasBlock)
        parts.push("block_detected");
    const recent = memory.responsePatterns.slice(-RECENT_PATTERNS_WINDOW);
    const noReplyCount = recent.filter((p) => p.reaction === "ignore").length;
    if (noReplyCount > 0)
        parts.push(`no_reply_signals=${noReplyCount}`);
    parts.push(`→ frequency=${frequency} style=${style}`);
    return parts.join("; ");
}
/**
 * Select outreach strategy based on RelationshipMemory.
 * Returns OutreachStrategy (frequency + style + fallbackCopy + rationale).
 * Does NOT write state.
 */
export function selectOutreachStrategy(memory, options) {
    const frequency = computeFrequency(memory);
    const style = computeStyle(memory, frequency);
    const rationale = buildRationale(memory, frequency, style);
    const fallbackCtx = options?.fallbackContext ?? {
        sourceRefs: [],
        reason: "Outreach conditions not met at this time.",
        channelId: undefined,
    };
    const fallbackCopy = buildFallbackCopy(fallbackCtx);
    return { frequency, style, fallbackCopy, rationale };
}
