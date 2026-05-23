/**
 * Tests for OutreachStrategySelector — T-GVS.C.3
 *
 * Covers:
 * - selectOutreachStrategy: frequency selection from no-reply signals, trust delta, block
 * - selectOutreachStrategy: style selection from tone patterns
 * - selectOutreachStrategy: fallback copy information value
 * - runStyleLint: DR-031 rules (no_dry_filler, anchored, no_over_explain)
 * - buildFallbackCopy: channel-safe, non-empty, contains anchor when available
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectOutreachStrategy,
  runStyleLint,
  buildFallbackCopy,
  type OutreachFrequency,
  type OutreachStyle,
} from "../../../src/guidance/outreach-strategy-selector.js";
import type { RelationshipMemory, ResponsePatternEntry } from "../../../src/guidance/channel-feedback-ingestion-service.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMemory(overrides: Partial<RelationshipMemory> = {}): RelationshipMemory {
  return {
    channelPreferences: [],
    responsePatterns: [],
    trustDelta: 0,
    ...overrides,
  };
}

function makePattern(
  reaction: ResponsePatternEntry["reaction"],
  tone: ResponsePatternEntry["tone"] = "neutral",
): ResponsePatternEntry {
  return {
    reaction,
    timing: "delayed",
    tone,
    observedAt: new Date().toISOString(),
  };
}

// ─── selectOutreachStrategy: frequency ───────────────────────────────────────

describe("selectOutreachStrategy — frequency", () => {
  it("returns standard when trust is positive and no signals", () => {
    const result = selectOutreachStrategy(makeMemory({ trustDelta: 0.3 }));
    assert.equal(result.frequency, "standard" satisfies OutreachFrequency);
  });

  it("returns reduced when ≥50% of recent 5 patterns are ignore", () => {
    const patterns: ResponsePatternEntry[] = [
      makePattern("ignore"),
      makePattern("ignore"),
      makePattern("ignore"),
      makePattern("reply", "positive"),
      makePattern("reply", "positive"),
    ];
    const result = selectOutreachStrategy(makeMemory({ responsePatterns: patterns }));
    assert.equal(result.frequency, "reduced" satisfies OutreachFrequency);
  });

  it("returns minimal when trustDelta <= -0.4", () => {
    const result = selectOutreachStrategy(makeMemory({ trustDelta: -0.5 }));
    assert.equal(result.frequency, "minimal" satisfies OutreachFrequency);
  });

  it("returns paused when any block reaction exists", () => {
    const patterns: ResponsePatternEntry[] = [
      makePattern("reply", "positive"),
      makePattern("block", "negative"),
    ];
    const result = selectOutreachStrategy(makeMemory({ trustDelta: 0.5, responsePatterns: patterns }));
    assert.equal(result.frequency, "paused" satisfies OutreachFrequency);
  });

  it("returns reduced for trustDelta between -0.4 and -0.1", () => {
    const result = selectOutreachStrategy(makeMemory({ trustDelta: -0.2 }));
    assert.equal(result.frequency, "reduced" satisfies OutreachFrequency);
  });
});

// ─── selectOutreachStrategy: style ───────────────────────────────────────────

describe("selectOutreachStrategy — style", () => {
  it("returns warm_anchored for mostly positive recent patterns", () => {
    const patterns: ResponsePatternEntry[] = [
      makePattern("reply", "positive"),
      makePattern("react", "positive"),
      makePattern("reply", "positive"),
    ];
    const result = selectOutreachStrategy(makeMemory({ responsePatterns: patterns, trustDelta: 0.3 }));
    assert.equal(result.style, "warm_anchored" satisfies OutreachStyle);
  });

  it("returns concise_factual for mixed/neutral patterns", () => {
    const patterns: ResponsePatternEntry[] = [
      makePattern("reply", "neutral"),
      makePattern("ignore", "neutral"),
    ];
    const result = selectOutreachStrategy(makeMemory({ responsePatterns: patterns }));
    assert.equal(result.style, "concise_factual" satisfies OutreachStyle);
  });

  it("returns light_check when paused", () => {
    const patterns: ResponsePatternEntry[] = [makePattern("block", "negative")];
    const result = selectOutreachStrategy(makeMemory({ responsePatterns: patterns }));
    assert.equal(result.style, "light_check" satisfies OutreachStyle);
  });

  it("returns light_check when mostly negative tone", () => {
    const patterns: ResponsePatternEntry[] = [
      makePattern("ignore", "negative"),
      makePattern("ignore", "negative"),
      makePattern("reply", "positive"),
    ];
    const result = selectOutreachStrategy(makeMemory({ responsePatterns: patterns }));
    assert.equal(result.style, "light_check" satisfies OutreachStyle);
  });
});

// ─── selectOutreachStrategy: fallback copy ───────────────────────────────────

describe("selectOutreachStrategy — fallback copy", () => {
  it("fallback copy has information value and non-empty text", () => {
    const result = selectOutreachStrategy(makeMemory());
    assert.ok(result.fallbackCopy.hasInformationValue);
    assert.ok(result.fallbackCopy.text.length > 0);
    assert.ok(result.fallbackCopy.channelSafeReason.length > 0);
  });

  it("fallback copy contains source anchor when provided", () => {
    const result = selectOutreachStrategy(makeMemory(), {
      fallbackContext: {
        sourceRefs: ["evidence:abc123"],
        reason: "Delivery unavailable.",
        channelId: "moltbook",
      },
    });
    assert.ok(result.fallbackCopy.sourceAnchor === "evidence:abc123");
    assert.ok(result.fallbackCopy.text.includes("evidence:abc123"));
  });

  it("fallback copy with sourceRefs and reason contains anchor in text", () => {
    const result = selectOutreachStrategy(makeMemory(), {
      fallbackContext: {
        sourceRefs: ["ref:my-observation"],
        reason: "Channel not available right now.",
        channelId: "instreet",
      },
    });
    assert.ok(result.fallbackCopy.text.includes("ref:my-observation"));
    assert.ok(result.fallbackCopy.channelSafeReason.includes("instreet"));
  });
});

// ─── runStyleLint ─────────────────────────────────────────────────────────────

describe("runStyleLint — DR-031 language quality checklist", () => {
  it("passes for anchored, concise draft with no filler", () => {
    const draft = "Based on your last message about project deadlines, wanted to share an observation.";
    const result = runStyleLint(draft);
    assert.equal(result.lintStatus, "passed");
    assert.equal(result.passed, true);
    assert.deepEqual(result.violations, []);
  });

  it("flags no_dry_filler for 'just checking in'", () => {
    const draft = "Hey, just checking in to see how things are going.";
    const result = runStyleLint(draft);
    assert.equal(result.lintStatus, "style_lint_failed");
    assert.ok(result.hitRules.includes("no_dry_filler"));
  });

  it("flags anchored when no concrete reference present", () => {
    const draft = "Wanted to say hello and see how you are doing today.";
    const result = runStyleLint(draft);
    assert.equal(result.lintStatus, "style_lint_failed");
    assert.ok(result.hitRules.includes("anchored"));
  });

  it("flags no_over_explain when ≥3 hedge phrases present", () => {
    const draft = "Based on what you said, maybe it could possibly work, not sure if perhaps this helps.";
    const result = runStyleLint(draft);
    assert.equal(result.lintStatus, "style_lint_failed");
    assert.ok(result.hitRules.includes("no_over_explain"));
  });

  it("style_lint_failed does not throw — degraded marker only", () => {
    // DR-031: lint failure is a marker, never an exception
    const draft = "Just following up to touch base.";
    assert.doesNotThrow(() => runStyleLint(draft));
    const result = runStyleLint(draft);
    assert.equal(result.lintStatus, "style_lint_failed");
  });

  it("returns specific rules hit in hitRules array", () => {
    const draft = "Just reaching out, maybe, possibly, not sure if this helps, perhaps.";
    const result = runStyleLint(draft);
    assert.ok(result.hitRules.includes("no_dry_filler"));
    assert.ok(result.hitRules.includes("anchored"));
    assert.ok(result.hitRules.includes("no_over_explain"));
  });
});

// ─── buildFallbackCopy ───────────────────────────────────────────────────────

describe("buildFallbackCopy", () => {
  it("always sets hasInformationValue = true", () => {
    const result = buildFallbackCopy({ sourceRefs: [], reason: "Unavailable." });
    assert.equal(result.hasInformationValue, true);
  });

  it("text is never empty string", () => {
    const result = buildFallbackCopy({ sourceRefs: [], reason: "Unavailable." });
    assert.ok(result.text.length > 0);
  });

  it("includes sourceRef anchor in text when refs provided", () => {
    const result = buildFallbackCopy({
      sourceRefs: ["claim:xyz"],
      reason: "Channel offline.",
      channelId: "moltbook",
    });
    assert.ok(result.text.includes("claim:xyz"));
    assert.equal(result.sourceAnchor, "claim:xyz");
  });

  it("channelSafeReason includes channelId when provided", () => {
    const result = buildFallbackCopy({
      sourceRefs: [],
      reason: "Platform maintenance.",
      channelId: "instreet",
    });
    assert.ok(result.channelSafeReason.includes("instreet"));
  });

  it("fallback copy text does not contain unsupported claims", () => {
    const result = buildFallbackCopy({
      sourceRefs: ["ref:real-data"],
      reason: "User is unavailable.",
    });
    // Must not contain fabricated claims — only the anchor and reason
    assert.ok(!result.text.includes("you definitely"));
    assert.ok(!result.text.includes("I know for sure"));
  });
});
