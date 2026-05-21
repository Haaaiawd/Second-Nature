/**
 * T4.2.1 — Owner reply inference unit tests (CR-04, M-05, M-06 coverage).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  inferTone,
  inferTiming,
  inferTopics,
  mergeTopicAffinities,
} from "../../../src/core/second-nature/feedback/owner-reply-feedback.js";

// ── inferTone ───────────────────────────────────────────────────────────────
test("inferTone: empty string → unknown", () => {
  assert.equal(inferTone(""), "unknown");
});

test("inferTone: whitespace only → unknown", () => {
  assert.equal(inferTone("  "), "unknown");
});

test("inferTone: positive keywords → casual", () => {
  assert.equal(inferTone("thanks a lot"), "casual");
});

test("inferTone: negative keywords → quiet", () => {
  assert.equal(inferTone("frustrated with this"), "quiet");
});

test("inferTone: conflicting tone (positive + negative) → quiet wins", () => {
  assert.equal(
    inferTone("I love this but I'm frustrated with the timing"),
    "quiet",
  );
});

// ── inferTiming ───────────────────────────────────────────────────────────────
test("inferTiming: busy keyword → busy", () => {
  assert.equal(inferTiming("busy"), "busy");
});

test("inferTiming: quick response → responsive", () => {
  assert.equal(inferTiming("quick response"), "responsive");
});

test("inferTiming: empty string → undefined", () => {
  assert.equal(inferTiming(""), undefined);
});

// ── inferTopics ───────────────────────────────────────────────────────────────
test("inferTopics: work project deadline → [work]", () => {
  const topics = inferTopics("work project deadline");
  assert.deepEqual(topics, ["work"]);
});

test("inferTopics: empty string → []", () => {
  assert.deepEqual(inferTopics(""), []);
});

// ── mergeTopicAffinities ──────────────────────────────────────────────────────
test("mergeTopicAffinities: empty existing + new topic → affinity 0.1", () => {
  const result = mergeTopicAffinities([], ["work"]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.topic, "work");
  assert.equal(result[0]!.affinity, 0.1);
});

// ── config override (M-05) ────────────────────────────────────────────────────
test("inferTone: config overrides default keywords", () => {
  assert.equal(
    inferTone("superb", { positiveKeywords: ["superb"] }),
    "casual",
  );
  assert.equal(
    inferTone("superb", { positiveKeywords: ["excellent"] }),
    "unknown",
  );
});

test("inferTiming: config overrides busy keywords", () => {
  assert.equal(
    inferTiming("snowed under", { busyKeywords: ["snowed under"] }),
    "busy",
  );
});

test("inferTopics: config overrides topic patterns", () => {
  assert.deepEqual(
    inferTopics("gardening", { topicPatterns: { hobby: ["gardening"] } }),
    ["hobby"],
  );
});
