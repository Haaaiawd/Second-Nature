/**
 * ClaimSynthesizer tests — T-DQS.C.1
 *
 * Coverage:
 * - EvidenceAggregator groups candidates by type and produces summary
 * - ClaimDeduplicator removes duplicate claims by sourceRef key
 * - ClaimSynthesizer:
 *   - single weak evidence → observation only
 *   - multiple evidence → fact
 *   - >=3 high-confidence evidence → pattern
 *   - empty slice → empty claims
 * - SourceValidator:
 *   - rejects fact claim with empty sourceRefs → claim_source_missing
 *   - accepts claim with non-empty sourceRefs
 *   - observation claims also require sourceRefs (DR-025)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  createEvidenceAggregator,
  createClaimDeduplicator,
  createClaimSynthesizer,
  createSourceValidator,
} from "../../../src/core/second-nature/quiet/claim-synthesizer.js";
import type { LifeEvidenceCandidate } from "../../../src/storage/life-evidence/types.js";
import type { QuietClaim } from "../../../src/shared/types/v7-entities.js";

function buildCandidate(
  overrides: Partial<LifeEvidenceCandidate> = {},
): LifeEvidenceCandidate {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    evidenceType: "platform_interaction",
    summary: "test evidence",
    sourceRefs: [{ id: "ref-1", kind: "platform_item", uri: "uri://1" }],
    sensitivity: "public",
    confidence: 0.8,
    tags: [],
    producer: "connector-system",
    ...overrides,
  };
}

describe("EvidenceAggregator", () => {
  it("groups candidates by evidenceType in summary", () => {
    const agg = createEvidenceAggregator();
    const result = agg.aggregate([
      buildCandidate({ evidenceType: "platform_interaction", summary: "A" }),
      buildCandidate({ evidenceType: "platform_interaction", summary: "B" }),
      buildCandidate({ evidenceType: "work_progress", summary: "C" }),
    ]);
    assert.strictEqual(result.items.length, 3);
    assert.ok(result.summary.includes("2 platform_interaction"));
    assert.ok(result.summary.includes("1 work_progress"));
  });

  it("returns empty summary for empty candidates", () => {
    const agg = createEvidenceAggregator();
    const result = agg.aggregate([]);
    assert.strictEqual(result.summary, "empty");
    assert.strictEqual(result.items.length, 0);
  });
});

describe("ClaimDeduplicator", () => {
  it("removes duplicate claims by sorted sourceRefs key", () => {
    const dedup = createClaimDeduplicator();
    const claims: QuietClaim[] = [
      {
        claimId: "c1",
        kind: "fact",
        text: "same",
        sourceRefs: ["a", "b"],
        confidence: 0.9,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        claimId: "c2",
        kind: "fact",
        text: "same",
        sourceRefs: ["b", "a"], // same refs, different order
        confidence: 0.9,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        claimId: "c3",
        kind: "observation",
        text: "different",
        sourceRefs: ["c"],
        confidence: 0.5,
        createdAt: "2025-01-01T00:00:00Z",
      },
    ];
    const result = dedup.deduplicate(claims);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some((c) => c.claimId === "c1" || c.claimId === "c2"));
    assert.ok(result.some((c) => c.claimId === "c3"));
  });

  it("preserves unique claims", () => {
    const dedup = createClaimDeduplicator();
    const claims: QuietClaim[] = [
      {
        claimId: "c1",
        kind: "fact",
        text: "one",
        sourceRefs: ["a"],
        confidence: 0.9,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        claimId: "c2",
        kind: "fact",
        text: "two",
        sourceRefs: ["b"],
        confidence: 0.8,
        createdAt: "2025-01-01T00:00:00Z",
      },
    ];
    assert.strictEqual(dedup.deduplicate(claims).length, 2);
  });
});

describe("ClaimSynthesizer", () => {
  it("single weak evidence produces observation", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({
      items: [buildCandidate({ confidence: 0.3 })],
      summary: "test",
    });
    assert.strictEqual(result.claims.length, 1);
    assert.strictEqual(result.claims[0]!.kind, "observation");
    assert.ok(result.claims[0]!.text.startsWith("Observed:"));
  });

  it("multiple evidence produces fact", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({
      items: [
        buildCandidate({ evidenceType: "platform_interaction", confidence: 0.6 }),
        buildCandidate({ evidenceType: "platform_interaction", confidence: 0.7 }),
      ],
      summary: "test",
    });
    assert.strictEqual(result.claims.length, 1);
    assert.strictEqual(result.claims[0]!.kind, "fact");
    assert.ok(result.claims[0]!.text.startsWith("Noted"));
  });

  it(">=3 high-confidence evidence produces pattern", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({
      items: [
        buildCandidate({ evidenceType: "work_progress", confidence: 0.8 }),
        buildCandidate({ evidenceType: "work_progress", confidence: 0.75 }),
        buildCandidate({ evidenceType: "work_progress", confidence: 0.9 }),
      ],
      summary: "test",
    });
    assert.strictEqual(result.claims.length, 1);
    assert.strictEqual(result.claims[0]!.kind, "pattern");
    assert.ok(result.claims[0]!.text.startsWith("Pattern detected"));
  });

  it("empty slice returns empty claims", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({ items: [], summary: "empty" });
    assert.strictEqual(result.claims.length, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("groups by evidenceType and synthesizes per group", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({
      items: [
        buildCandidate({ evidenceType: "platform_interaction", confidence: 0.8 }),
        buildCandidate({ evidenceType: "work_progress", confidence: 0.8 }),
      ],
      summary: "test",
    });
    assert.strictEqual(result.claims.length, 2);
    const kinds = result.claims.map((c) => c.kind);
    assert.ok(kinds.every((k) => k === "fact"));
  });

  it("sourceRefs are non-empty tuples", () => {
    const synth = createClaimSynthesizer();
    const result = synth.synthesize({
      items: [buildCandidate({ confidence: 0.8 })],
      summary: "test",
    });
    assert.ok(result.claims[0]!.sourceRefs.length > 0);
    assert.ok(typeof result.claims[0]!.sourceRefs[0] === "string");
  });
});

describe("SourceValidator", () => {
  it("accepts fact claim with non-empty sourceRefs", () => {
    const validator = createSourceValidator();
    const result = validator.validate({
      claimId: "c1",
      kind: "fact",
      text: "test",
      sourceRefs: ["ref-a"],
      confidence: 0.9,
      createdAt: "2025-01-01T00:00:00Z",
    });
    assert.strictEqual(result.ok, true);
  });

  it("rejects fact claim with empty sourceRefs", () => {
    const validator = createSourceValidator();
    const result = validator.validate({
      claimId: "c1",
      kind: "fact",
      text: "test",
      sourceRefs: [] as unknown as [string, ...string[]],
      confidence: 0.9,
      createdAt: "2025-01-01T00:00:00Z",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual((result as { ok: false; reason: string }).reason, "claim_source_missing");
  });

  it("rejects observation claim with empty sourceRefs (DR-025)", () => {
    const validator = createSourceValidator();
    const result = validator.validate({
      claimId: "c1",
      kind: "observation",
      text: "test",
      sourceRefs: [] as unknown as [string, ...string[]],
      confidence: 0.5,
      createdAt: "2025-01-01T00:00:00Z",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual((result as { ok: false; reason: string }).reason, "claim_source_missing");
  });

  it("rejects claim with blank sourceRef string", () => {
    const validator = createSourceValidator();
    const result = validator.validate({
      claimId: "c1",
      kind: "fact",
      text: "test",
      sourceRefs: ["  "] as [string, ...string[]],
      confidence: 0.9,
      createdAt: "2025-01-01T00:00:00Z",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual((result as { ok: false; reason: string }).reason, "claim_source_missing");
  });
});
