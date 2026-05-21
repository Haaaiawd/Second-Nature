/**
 * Unit coverage for `draftNarrativeOutreach` (T6.1.1).
 *
 * Verifies source-backed draft generation, missing source blocking,
 * insufficient source degradation, and insufficient_history tone.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { draftNarrativeOutreach } from "../../../src/guidance/draft-narrative-outreach.js";
import type { SourceRef } from "../../../src/storage/narrative/narrative-state-store.js";

function makeRef(id: string): SourceRef {
  return { sourceId: id, kind: "platform_item", url: `https://example.com/${id}` };
}

test("T6.1.1 draft includes what happened, why it matters, and source refs", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1"), makeRef("ev-2")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "EvoMap profile updated",
      progress: ["connected node"],
      nextIntent: "verify task claim",
      confidence: 0.8,
      sourceRefs: [makeRef("ev-1")],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "casual",
      noReplyCount: 0,
      topicAffinities: [{ topic: "work", affinity: 0.5 }],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  assert.equal(result.groundingReport.status, "grounded");
  assert.equal(result.draft.whatHappened, "EvoMap profile updated");
  assert.ok(result.draft.whyItMatters.includes("verify task claim"));
  assert.equal(result.draft.sourceRefs.length, 2);
  assert.equal(result.draft.tone, "friend");
  assert.equal(result.promptVersion, "v6-rules-only-1.0");
});

test("T6.1.1 blocked when source refs missing", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "something happened",
      progress: [],
      nextIntent: "",
      confidence: 0.5,
      sourceRefs: [],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  });

  assert.equal(result.groundingReport.status, "blocked");
  assert.equal(result.draft.tone, "blocked");
  assert.equal(result.draft.whatHappened, "");
  assert.ok(result.groundingReport.unsupportedClaims.includes("missing_evidence_refs"));
});

test("T6.1.1 degraded when source coverage is low", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "unrelated focus A",
      progress: ["unrelated progress B"],
      nextIntent: "",
      confidence: 0.5,
      sourceRefs: [],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  });

  assert.equal(result.groundingReport.status, "degraded");
  assert.equal(result.draft.tone, "insufficient_history");
  assert.ok(result.groundingReport.sourceCoverage < 0.5);
});

test("T6.1.1 insufficient_history tone when relationship depth is low", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "EvoMap profile updated",
      progress: ["connected node"],
      nextIntent: "verify task claim",
      confidence: 0.8,
      sourceRefs: [makeRef("ev-1")],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "quiet",
      noReplyCount: 5,
      topicAffinities: [],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  assert.equal(result.groundingReport.status, "grounded");
  assert.equal(result.draft.tone, "insufficient_history");
});

test("T6.1.1 friend tone when relationship depth is adequate", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "EvoMap profile updated",
      progress: ["connected node"],
      nextIntent: "verify task claim",
      confidence: 0.8,
      sourceRefs: [makeRef("ev-1")],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "casual",
      noReplyCount: 0,
      topicAffinities: [{ topic: "work", affinity: 0.5 }],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  assert.equal(result.draft.tone, "friend");
});

// Boundary tests for Wave 26 fix

test("T6.1.1 boundary: empty narrative state fields with evidence", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "",
      progress: [],
      nextIntent: "",
      confidence: 0.0,
      sourceRefs: [],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "casual",
      noReplyCount: 0,
      topicAffinities: [],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  // With evidence refs present but empty fields, function returns grounded
  // because evidence exists; tone is insufficient_history due to empty content
  assert.equal(result.groundingReport.status, "grounded");
  assert.equal(result.draft.tone, "insufficient_history");
  assert.equal(result.draft.whatHappened, "");
  // whyItMatters gets a default fallback when empty
  assert.ok(result.draft.whyItMatters.length > 0);
});

test("T6.1.1 boundary: undefined relationship memory", () => {
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "EvoMap profile updated",
      progress: ["connected node"],
      nextIntent: "verify task claim",
      confidence: 0.8,
      sourceRefs: [makeRef("ev-1")],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  });

  assert.equal(result.groundingReport.status, "grounded");
  assert.equal(result.draft.tone, "insufficient_history");
  assert.equal(result.draft.whatHappened, "EvoMap profile updated");
});

test("T6.1.1 boundary: maximum evidence refs", () => {
  const maxRefs = Array.from({ length: 1000 }, (_, i) => makeRef(`ev-${i}`));
  
  const result = draftNarrativeOutreach({
    evidenceRefs: maxRefs,
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: "bulk activity",
      progress: ["many actions"],
      nextIntent: "continue",
      confidence: 0.9,
      sourceRefs: maxRefs.slice(0, 100),
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "casual",
      noReplyCount: 0,
      topicAffinities: [{ topic: "work", affinity: 0.8 }],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  assert.equal(result.groundingReport.status, "grounded");
  assert.equal(result.draft.tone, "friend");
  assert.equal(result.draft.sourceRefs.length, 1000);
  assert.ok(result.groundingReport.sourceCoverage > 0.1);
});

test("T6.1.1 boundary: very long focus and progress strings", () => {
  const longString = "a".repeat(10000);
  
  const result = draftNarrativeOutreach({
    evidenceRefs: [makeRef("ev-1")],
    narrativeState: {
      narrativeId: "n1",
      revision: 1,
      focus: longString,
      progress: [longString, longString],
      nextIntent: longString,
      confidence: 0.8,
      sourceRefs: [makeRef("ev-1")],
      unsupportedClaims: [],
      status: "active",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    relationshipMemory: {
      relationshipId: "r1",
      revision: 1,
      tonePreference: "casual",
      noReplyCount: 0,
      topicAffinities: [{ topic: "work", affinity: 0.5 }],
      updatedAt: "2026-05-16T00:00:00.000Z",
      sourceRefs: [],
    },
  });

  // Very long strings trigger degraded status due to content length limits
  assert.equal(result.groundingReport.status, "degraded");
  assert.equal(result.draft.tone, "insufficient_history");
  assert.equal(result.draft.whatHappened, longString);
});
