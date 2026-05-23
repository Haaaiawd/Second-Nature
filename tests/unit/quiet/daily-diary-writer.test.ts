/**
 * DailyDiaryWriter tests — T-DQS.C.1
 *
 * Coverage:
 * - observedToday populated from observation claims
 * - notableSignals populated from fact claims
 * - tomorrowDirection from pattern claims, fallback to facts, fallback to observations
 * - empty claims → "Nothing significant today." + diary_empty error
 * - sourceRefs aggregated from all claims (deduplicated)
 * - section limit: at most 5 entries per section
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createDailyDiaryWriter } from "../../../src/core/second-nature/quiet/daily-diary-writer.js";
import type { QuietClaim } from "../../../src/shared/types/v7-entities.js";

function buildClaim(
  kind: QuietClaim["kind"],
  text: string,
  sourceRefs: string[] = ["ref-a"],
): QuietClaim {
  return {
    claimId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    kind,
    text,
    sourceRefs: sourceRefs as [string, ...string[]],
    confidence: 0.8,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

describe("DailyDiaryWriter", () => {
  it("produces three sections from mixed claims", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [
        buildClaim("observation", "Saw user post"),
        buildClaim("fact", "User engagement up"),
        buildClaim("pattern", "Weekly trend"),
      ],
      "2025-01-01",
    );

    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.diary.observedToday.includes("Saw user post"));
    assert.ok(result.diary.notableSignals.includes("User engagement up"));
    assert.ok(result.diary.tomorrowDirection.includes("Continue watching"));
    assert.ok(result.diary.tomorrowDirection.includes("Weekly trend"));
    assert.strictEqual(result.diary.day, "2025-01-01");
    assert.ok(result.diary.diaryId.startsWith("diary:2025-01-01"));
  });

  it("observedToday comes from observation claims only", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [
        buildClaim("observation", "Obs 1"),
        buildClaim("observation", "Obs 2"),
        buildClaim("fact", "Fact 1"),
      ],
      "2025-01-02",
    );

    assert.strictEqual(result.diary.observedToday.length, 2);
    assert.ok(result.diary.observedToday.every((t) => t.startsWith("Obs")));
    assert.strictEqual(result.diary.notableSignals.length, 1);
  });

  it("notableSignals comes from fact claims only", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [
        buildClaim("fact", "Fact A"),
        buildClaim("fact", "Fact B"),
        buildClaim("pattern", "Pattern X"),
      ],
      "2025-01-03",
    );

    assert.strictEqual(result.diary.notableSignals.length, 2);
    assert.ok(result.diary.notableSignals.every((t) => t.startsWith("Fact")));
  });

  it("tomorrowDirection uses pattern when available", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [buildClaim("pattern", "Rising interest")],
      "2025-01-04",
    );

    assert.ok(result.diary.tomorrowDirection.includes("Continue watching"));
    assert.ok(result.diary.tomorrowDirection.includes("Rising interest"));
  });

  it("tomorrowDirection falls back to facts when no patterns", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [buildClaim("fact", "Metric changed")],
      "2025-01-05",
    );

    assert.ok(result.diary.tomorrowDirection.includes("Follow up"));
  });

  it("tomorrowDirection falls back to observations when no facts/patterns", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [buildClaim("observation", "Saw something")],
      "2025-01-06",
    );

    assert.ok(result.diary.tomorrowDirection.includes("Keep observing"));
  });

  it("empty claims produce empty sections with diary_empty error", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write([], "2025-01-07");

    assert.deepStrictEqual(result.diary.observedToday, []);
    assert.deepStrictEqual(result.diary.notableSignals, []);
    assert.strictEqual(result.diary.tomorrowDirection, "Nothing significant today.");
    assert.ok(result.errors.includes("diary_empty:no_claims"));
  });

  it("sourceRefs are deduplicated across all claims", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write(
      [
        buildClaim("observation", "O1", ["ref-a", "ref-b"]),
        buildClaim("fact", "F1", ["ref-b", "ref-c"]),
      ],
      "2025-01-08",
    );

    assert.strictEqual(result.diary.sourceRefs.length, 3);
    assert.ok(result.diary.sourceRefs.includes("ref-a"));
    assert.ok(result.diary.sourceRefs.includes("ref-b"));
    assert.ok(result.diary.sourceRefs.includes("ref-c"));
  });

  it("sections limited to at most 5 entries", () => {
    const writer = createDailyDiaryWriter();
    const observations = Array.from({ length: 8 }, (_, i) =>
      buildClaim("observation", `Obs ${i + 1}`),
    );
    const result = writer.write(observations, "2025-01-09");

    assert.strictEqual(result.diary.observedToday.length, 5);
  });

  it("createdAt is ISO string", () => {
    const writer = createDailyDiaryWriter();
    const result = writer.write([buildClaim("fact", "Test")], "2025-01-10");

    assert.ok(result.diary.createdAt > "2024-01-01");
  });
});
