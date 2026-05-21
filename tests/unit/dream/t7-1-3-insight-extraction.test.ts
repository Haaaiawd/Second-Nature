import test from "node:test";
import assert from "node:assert/strict";

import { extractInsights } from "../../../src/dream/insight-extractor.js";

test("T7.1.3 extractInsights finds patterns from recurring words", () => {
  const result = extractInsights({
    evidenceSummaries: [
      { id: "ev-1", summary: "Working on architecture design today", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Architecture discussion with team", createdAt: "2026-05-11T10:00:00Z" },
      { id: "ev-3", summary: "More architecture decisions needed", createdAt: "2026-05-12T10:00:00Z" },
    ],
    chronicleSummaries: [],
  });

  const pattern = result.insights.find((i) => i.type === "pattern");
  assert.ok(pattern, "Should find pattern insight for recurring 'architecture'");
  assert.ok(pattern!.sourceRefs.includes("ev-1"));
  assert.ok(pattern!.confidence > 0.5);
});

test("T7.1.3 extractInsights detects learning keywords", () => {
  const result = extractInsights({
    evidenceSummaries: [
      { id: "ev-1", summary: "Learned a new approach to testing", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Discovered better method for caching", createdAt: "2026-05-11T10:00:00Z" },
    ],
    chronicleSummaries: [],
  });

  const learning = result.insights.find((i) => i.type === "learning");
  assert.ok(learning, "Should find learning insight");
  assert.ok(learning!.sourceRefs.includes("ev-1"));
});

test("T7.1.3 extractInsights detects conflicts from repeated failures", () => {
  const result = extractInsights({
    evidenceSummaries: [
      { id: "ev-1", summary: "Build failed due to missing dependency", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Tests failing again after update", createdAt: "2026-05-11T10:00:00Z" },
      { id: "ev-3", summary: "Deployment error this morning", createdAt: "2026-05-12T10:00:00Z" },
    ],
    chronicleSummaries: [],
  });

  const conflict = result.insights.find((i) => i.type === "conflict");
  assert.ok(conflict, "Should find conflict insight for repeated failures");
});

test("T7.1.3 extractInsights detects high-activity observation", () => {
  const result = extractInsights({
    evidenceSummaries: [
      { id: "ev-1", summary: "Event A", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Event B", createdAt: "2026-05-10T11:00:00Z" },
      { id: "ev-3", summary: "Event C", createdAt: "2026-05-10T12:00:00Z" },
      { id: "ev-4", summary: "Event D", createdAt: "2026-05-10T13:00:00Z" },
    ],
    chronicleSummaries: [],
  });

  const observation = result.insights.find((i) => i.type === "observation");
  assert.ok(observation, "Should find observation for high-activity day");
  assert.ok(observation!.summary.includes("High activity"));
});

test("T7.1.3 no evidence returns unsupported claim", () => {
  const result = extractInsights({
    evidenceSummaries: [],
    chronicleSummaries: [],
  });

  assert.equal(result.insights.length, 0);
  assert.ok(result.unsupportedClaims.includes("no_evidence_for_insight"));
});

test("T7.1.3 each insight has sourceRefs and confidence", () => {
  const result = extractInsights({
    evidenceSummaries: [
      { id: "ev-1", summary: "Learned a new approach to testing", createdAt: "2026-05-10T10:00:00Z" },
      { id: "ev-2", summary: "Discovered better method for caching", createdAt: "2026-05-11T10:00:00Z" },
    ],
    chronicleSummaries: [],
  });

  for (const insight of result.insights) {
    assert.ok(insight.id.length > 0);
    assert.ok(["pattern", "learning", "observation", "conflict"].includes(insight.type));
    assert.ok(insight.summary.length > 0);
    assert.ok(insight.sourceRefs.length > 0);
    assert.ok(insight.confidence >= 0 && insight.confidence <= 1);
  }
});
