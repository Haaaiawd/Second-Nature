import test from "node:test";
import assert from "node:assert/strict";

import { draftNarrativeFromDream } from "../../../src/dream/narrative-update-proposal.js";

test("T7.1.4 draftNarrative generates source-backed focus and progress", () => {
  const result = draftNarrativeFromDream({
    evidenceSummaries: [
      { id: "ev-1", summary: "Exploring new connector architecture", createdAt: "2026-05-10T10:00:00Z" },
    ],
    insights: [
      {
        id: "ins-1",
        type: "learning",
        summary: "Learned how to wire connector registry",
        sourceRefs: ["ev-1"],
        confidence: 0.75,
      },
    ],
  });

  const { proposal } = result;
  assert.ok(proposal);
  if (proposal) {
    assert.ok(proposal.focus.length > 0);
    assert.ok(proposal.progressAdditions.length > 0);
    assert.ok(proposal.sourceRefs.includes("ev-1"));
    assert.ok(proposal.confidenceDelta > 0);
  }
  assert.equal(result.blocked, false);
});

test("T7.1.4 conflict insight changes nextIntent to resolve", () => {
  const result = draftNarrativeFromDream({
    evidenceSummaries: [
      { id: "ev-1", summary: "Build keeps failing", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Tests also broken", createdAt: "2026-05-11T10:00:00Z" },
    ],
    insights: [
      {
        id: "ins-1",
        type: "conflict",
        summary: "Repeated build failures",
        sourceRefs: ["ev-1", "ev-2"],
        confidence: 0.6,
      },
    ],
  });

  const { proposal } = result;
  assert.ok(proposal);
  if (proposal) {
    assert.ok(proposal.nextIntent.includes("resolve"));
  }
});

test("T7.1.4 no evidence blocks with unsupported claim", () => {
  const result = draftNarrativeFromDream({
    evidenceSummaries: [],
    insights: [],
  });

  assert.equal(result.proposal, undefined);
  assert.equal(result.blocked, true);
  assert.ok(result.unsupportedClaims.includes("no_evidence_for_narrative"));
});

test("T7.1.4 low confidence degrades but does not block above threshold", () => {
  const result = draftNarrativeFromDream({
    evidenceSummaries: [
      { id: "ev-1", summary: "Something happened", createdAt: "2026-05-10T10:00:00Z" },
    ],
    insights: [
      {
        id: "ins-1",
        type: "observation",
        summary: "Unclear event",
        sourceRefs: ["ev-1"],
        confidence: 0.25,
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(result.unsupportedClaims.includes("low_average_confidence_for_narrative"));
  assert.equal(result.blocked, false); // blocked only if < 0.2
});

test("T7.1.4 very low confidence blocks proposal", () => {
  const result = draftNarrativeFromDream({
    evidenceSummaries: [],
    insights: [
      {
        id: "ins-1",
        type: "observation",
        summary: "Very unclear",
        sourceRefs: [],
        confidence: 0.1,
      },
    ],
  });

  assert.equal(result.blocked, true);
});
