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
import type { RelationshipMemory } from "./channel-feedback-ingestion-service.js";
export type OutreachFrequency = "standard" | "reduced" | "minimal" | "paused";
export type OutreachStyle = "warm_anchored" | "concise_factual" | "light_check";
export interface OutreachStrategy {
    frequency: OutreachFrequency;
    style: OutreachStyle;
    fallbackCopy: FallbackCopy;
    rationale: string;
}
export interface FallbackCopy {
    text: string;
    hasInformationValue: boolean;
    sourceAnchor?: string;
    channelSafeReason: string;
}
export interface StyleLintResult {
    passed: boolean;
    violations: StyleLintViolation[];
    /**
     * If lint fails, this is the degraded marker (DR-031).
     * Never blocks delivery — caller decides what to do with it.
     */
    lintStatus: "passed" | "style_lint_failed";
    hitRules: StyleLintRule[];
}
export type StyleLintRule = "no_dry_filler" | "anchored" | "no_over_explain";
export interface StyleLintViolation {
    rule: StyleLintRule;
    description: string;
}
export interface FallbackContext {
    sourceRefs: string[];
    reason: string;
    channelId?: string;
    ownerPreferenceRef?: string;
}
/**
 * Run DR-031 language quality checklist on a draft text.
 * Returns StyleLintResult. style_lint_failed is a degraded marker — never blocks delivery.
 */
export declare function runStyleLint(draftText: string): StyleLintResult;
/**
 * Build channel-safe fallback copy that always has information value (DR-031 G4).
 * Never returns empty string. Includes sourceRefs anchor and human-readable channel reason.
 */
export declare function buildFallbackCopy(ctx: FallbackContext): FallbackCopy;
export interface OutreachStrategySelectorOptions {
    fallbackContext?: FallbackContext;
}
/**
 * Select outreach strategy based on RelationshipMemory.
 * Returns OutreachStrategy (frequency + style + fallbackCopy + rationale).
 * Does NOT write state.
 */
export declare function selectOutreachStrategy(memory: RelationshipMemory, options?: OutreachStrategySelectorOptions): OutreachStrategy;
