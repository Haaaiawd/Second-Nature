/**
 * Fixture-based style lint tests — T-GVS.C.3 (DR-031)
 *
 * Covers:
 * - dry/plain draft → style_lint_failed with specific rule list
 * - anchored + concise draft → passed, no degraded marker
 * - fallback copy with sourceRefs + reason → concrete anchor, channel-safe reason, no unsupported claim
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runStyleLint, buildFallbackCopy } from "../../../src/guidance/outreach-strategy-selector.js";

// ─── Fixture: dry/plain draft ─────────────────────────────────────────────────

const DRY_PLAIN_FIXTURE = "Hey, just checking in! Reaching out to touch base — hope you're well.";

// ─── Fixture: anchored + concise draft ───────────────────────────────────────

const ANCHORED_CONCISE_FIXTURE =
  "After reading your update last week about the workshop [ref:workshop-2026-05], noticed a connection to the project thread you mentioned.";

// ─── Fixture: fallback context ────────────────────────────────────────────────

const FALLBACK_FIXTURE_CTX = {
  sourceRefs: ["ref:observation-2026-05-23", "ref:goal-completion"],
  reason: "Delivery channel currently unavailable due to platform maintenance.",
  channelId: "moltbook",
  ownerPreferenceRef: "pref:moltbook-timing",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("outreach-style-fixtures: dry/plain draft", () => {
  it("dry/plain draft returns style_lint_failed", () => {
    const result = runStyleLint(DRY_PLAIN_FIXTURE);
    assert.equal(result.lintStatus, "style_lint_failed");
  });

  it("dry/plain draft lists no_dry_filler in hitRules", () => {
    const result = runStyleLint(DRY_PLAIN_FIXTURE);
    assert.ok(result.hitRules.includes("no_dry_filler"), `hitRules: ${JSON.stringify(result.hitRules)}`);
  });

  it("dry/plain draft lists anchored in hitRules (no concrete reference)", () => {
    const result = runStyleLint(DRY_PLAIN_FIXTURE);
    assert.ok(result.hitRules.includes("anchored"), `hitRules: ${JSON.stringify(result.hitRules)}`);
  });

  it("violations array is non-empty for dry/plain draft", () => {
    const result = runStyleLint(DRY_PLAIN_FIXTURE);
    assert.ok(result.violations.length > 0);
  });
});

describe("outreach-style-fixtures: anchored + concise draft", () => {
  it("anchored + concise draft passes lint", () => {
    const result = runStyleLint(ANCHORED_CONCISE_FIXTURE);
    assert.equal(result.lintStatus, "passed");
  });

  it("anchored + concise draft produces no violations", () => {
    const result = runStyleLint(ANCHORED_CONCISE_FIXTURE);
    assert.deepEqual(result.violations, []);
  });

  it("anchored + concise draft has empty hitRules", () => {
    const result = runStyleLint(ANCHORED_CONCISE_FIXTURE);
    assert.deepEqual(result.hitRules, []);
  });
});

describe("outreach-style-fixtures: fallback copy with sourceRefs + reason", () => {
  it("fallback copy text contains first sourceRef as anchor", () => {
    const fc = buildFallbackCopy(FALLBACK_FIXTURE_CTX);
    assert.ok(
      fc.text.includes("ref:observation-2026-05-23"),
      `text: ${fc.text}`,
    );
  });

  it("fallback copy channelSafeReason contains channelId", () => {
    const fc = buildFallbackCopy(FALLBACK_FIXTURE_CTX);
    assert.ok(fc.channelSafeReason.includes("moltbook"), `channelSafeReason: ${fc.channelSafeReason}`);
  });

  it("fallback copy does not contain unsupported claims", () => {
    const fc = buildFallbackCopy(FALLBACK_FIXTURE_CTX);
    const unsupportedClaims = ["you definitely", "I know for sure", "guaranteed", "certainly will"];
    for (const claim of unsupportedClaims) {
      assert.ok(!fc.text.includes(claim), `Found unsupported claim "${claim}" in: ${fc.text}`);
    }
  });

  it("fallback copy hasInformationValue is always true", () => {
    const fc = buildFallbackCopy(FALLBACK_FIXTURE_CTX);
    assert.equal(fc.hasInformationValue, true);
  });

  it("fallback copy text is non-empty even with no sourceRefs", () => {
    const fc = buildFallbackCopy({ sourceRefs: [], reason: "Platform offline.", channelId: "instreet" });
    assert.ok(fc.text.length > 0);
    assert.equal(fc.hasInformationValue, true);
  });
});
