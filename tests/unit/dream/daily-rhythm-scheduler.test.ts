/**
 * DailyRhythmScheduler — Unit Tests (T-DQ.R.2)
 *
 * Validates: due/completed/blocked/skip states, Quiet/Dream cadence,
 * absence reasons, and state persistence.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";

describe("daily-rhythm-scheduler", () => {
  function makeClosure(day: string, overrides?: Record<string, unknown>) {
    return {
      id: `closure_${day}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cycleId: `cycle_${day}`,
      status: "completed" as const,
      closureStatus: "completed" as const,
      inputSummary: "test",
      outputSummary: "done",
      postProcessing: [],
      nextState: "ok",
      reason: "closure_completed",
      sourceRefs: [
        { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
      ],
      createdAt: `${day}T12:00:00Z`,
      closedAt: `${day}T12:00:00Z`,
      dispatchAttempt: 1,
      ...overrides,
    };
  }

  it("marks not_due when no closures exist", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await checkDailyRhythm(db, { now: "2026-06-05T10:00:00Z" });
      assert.equal(result.status, "checked");
      if (result.status === "checked") {
        assert.equal(result.state.quietStatus, "not_due");
        assert.equal(result.state.quietReason, "quiet_empty_input");
        assert.equal(result.state.dreamStatus, "not_due");
        assert.equal(result.state.dreamReason, "quiet_empty_input");
      }
    } finally {
      db.close();
    }
  });

  it("marks due and runs Quiet when closures exist", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeActionClosureRecord(db, makeClosure("2026-06-05"));

      const result = await checkDailyRhythm(db, { now: "2026-06-05T10:00:00Z", forceQuiet: true });
      assert.equal(result.status, "checked");
      if (result.status === "checked") {
        assert.equal(result.state.quietStatus, "completed");
        assert.equal(result.state.quietReason, "quiet_completed");
        assert.ok(result.state.quietCompletedAt);
        // Dream is scheduled and immediately executed after Quiet (T-DQ.R.7)
        assert.equal(result.state.dreamStatus, "completed");
        assert.equal(result.state.dreamReason, "dream_completed");
      }
    } finally {
      db.close();
    }
  });

  it("blocks Dream when scheduler unavailable", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeActionClosureRecord(db, makeClosure("2026-06-05"));

      const result = await checkDailyRhythm(db, {
        now: "2026-06-05T10:00:00Z",
        forceQuiet: true,
        schedulerAvailable: false,
      });
      assert.equal(result.status, "checked");
      if (result.status === "checked") {
        assert.equal(result.state.quietStatus, "completed");
        assert.equal(result.state.dreamStatus, "blocked");
        assert.equal(result.state.dreamReason, "dream_scheduler_unavailable");
      }
    } finally {
      db.close();
    }
  });

  it("persists state across multiple checks", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeActionClosureRecord(db, makeClosure("2026-06-05"));

      // First check
      const r1 = await checkDailyRhythm(db, { now: "2026-06-05T10:00:00Z", forceQuiet: true });
      assert.equal(r1.status, "checked");

      // Second check should not re-run
      const r2 = await checkDailyRhythm(db, { now: "2026-06-05T11:00:00Z" });
      assert.equal(r2.status, "checked");
      if (r2.status === "checked") {
        assert.equal(r2.state.quietStatus, "completed");
        assert.equal(r2.state.dreamStatus, "completed");
      }
    } finally {
      db.close();
    }
  });
});
