/**
 * DiaryDreamStore tests — T-SMS.C.7
 *
 * Coverage:
 * - writeDailyDiary + loadDailyDiary round-trip
 * - appendDreamOutput stores candidate output
 * - transitionDreamOutputLifecycle candidate->accepted
 * - transitionDreamOutputLifecycle rejected for invalid transition
 * - loadAcceptedDreamProjection filters out candidate
 * - listDreamOutputs returns all statuses
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";
import { createDiaryDreamStore } from "../../../src/storage/services/diary-dream-store.js";
import type { DreamOutput } from "../../../src/shared/types/v7-entities.js";

describe("DiaryDreamStore", () => {
  const baseValidation: DreamOutput["validation"] = {
    schemaValid: true,
    sourceGrounded: true,
    sensitivityClean: true,
    unsupportedClaims: [],
    errors: [],
    checkedAt: "2025-01-01T00:00:00Z",
  };

  it("writeDailyDiary round-trip", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    await store.writeDailyDiary({
      diaryId: "d1",
      day: "2025-01-15",
      observedToday: ["Woke early", "Read a chapter"],
      notableSignals: ["Mood stable"],
      tomorrowDirection: "Finish chapter 2",
      sourceRefs: ["store:diary"],
      createdAt: "2025-01-15T23:00:00Z",
    });

    const loaded = await store.loadDailyDiary("2025-01-15");
    assert.strictEqual(loaded!.day, "2025-01-15");
    assert.strictEqual(loaded!.observedToday.length, 2);
    assert.strictEqual(loaded!.tomorrowDirection, "Finish chapter 2");
    db.close();
  });

  it("appendDreamOutput + listDreamOutputs", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    const output: DreamOutput = {
      outputId: "out-1",
      runId: "run-1",
      status: "candidate",
      canonicalEntries: [{ text: "Entry A" }],
      insights: [{ note: "Insight 1" }],
      validation: baseValidation,
      createdAt: "2025-01-01T00:00:00Z",
    };

    await store.appendDreamOutput(output);
    const list = await store.listDreamOutputs(10);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0]!.outputId, "out-1");
    assert.strictEqual(list[0]!.status, "candidate");
    db.close();
  });

  it("transitionDreamOutputLifecycle candidate->accepted", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    await store.appendDreamOutput({
      outputId: "out-2",
      runId: "run-1",
      status: "candidate",
      canonicalEntries: [],
      insights: [],
      validation: baseValidation,
      createdAt: "2025-01-01T00:00:00Z",
    });

    await store.transitionDreamOutputLifecycle("out-2", "accepted");
    const accepted = await store.loadAcceptedDreamProjection(10);
    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(accepted[0]!.outputId, "out-2");
    assert.strictEqual(accepted[0]!.status, "accepted");
    db.close();
  });

  it("loadAcceptedDreamProjection excludes candidate", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    await store.appendDreamOutput({
      outputId: "out-c",
      runId: "run-1",
      status: "candidate",
      canonicalEntries: [],
      insights: [],
      validation: baseValidation,
      createdAt: "2025-01-01T00:00:00Z",
    });

    const accepted = await store.loadAcceptedDreamProjection(10);
    assert.strictEqual(accepted.length, 0);
    db.close();
  });

  it("transitionDreamOutputLifecycle rejects invalid transition", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    await store.appendDreamOutput({
      outputId: "out-3",
      runId: "run-1",
      status: "archived",
      canonicalEntries: [],
      insights: [],
      validation: baseValidation,
      createdAt: "2025-01-01T00:00:00Z",
    });

    await assert.rejects(
      store.transitionDreamOutputLifecycle("out-3", "accepted"),
      /invalid_transition/,
    );
    db.close();
  });

  it("transitionDreamOutputLifecycle rejects missing output", async () => {
    const db = createStateDatabase(":memory:");
    const store = createDiaryDreamStore(db);

    await assert.rejects(
      store.transitionDreamOutputLifecycle("missing", "accepted"),
      /dream_output_not_found/,
    );
    db.close();
  });
});
