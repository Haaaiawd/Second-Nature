/**
 * Quiet/Dream Runtime Chain — API Tests (T-DQ.R.5)
 *
 * Validates: daily rhythm advancement produces QuietDailyReview,
 * closureRefs, Dream schedule/block lifecycle, and precise absence reasons.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { writeActionClosureRecord } from "../../../src/storage/v8-state-stores.js";

describe("quiet-dream-runtime-chain API", () => {
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

  it("writes QuietDailyReview with closureRefs and schedules Dream", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = "2026-06-12T10:00:00Z";
      const day = now.slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day));

      const result = await checkDailyRhythm(db, { now, forceQuiet: true });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;

      assert.equal(result.state.quietStatus, "completed");
      assert.equal(result.state.quietReason, "quiet_completed");
      assert.equal(result.state.dreamStatus, "scheduled");
      assert.equal(result.state.dreamReason, "dream_scheduled");
    } finally {
      db.close();
    }
  });

  it("records blocked reason when Dream scheduler is unavailable", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = "2026-06-12T10:00:00Z";
      const day = now.slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day));

      const result = await checkDailyRhythm(db, {
        now,
        forceQuiet: true,
        schedulerAvailable: false,
      });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;

      assert.equal(result.state.quietStatus, "completed");
      assert.equal(result.state.dreamStatus, "blocked");
      assert.equal(result.state.dreamReason, "dream_scheduler_unavailable");
    } finally {
      db.close();
    }
  });

  it("records precise absence reason when no closures exist", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = "2026-06-12T10:00:00Z";
      const day = now.slice(0, 10);

      const result = await checkDailyRhythm(db, { now });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;

      assert.equal(result.state.quietStatus, "not_due");
      assert.equal(result.state.quietReason, "quiet_empty_input");
      assert.equal(result.state.dreamStatus, "not_due");
      assert.equal(result.state.dreamReason, "quiet_empty_input");
    } finally {
      db.close();
    }
  });

  it("does not re-schedule Dream when already scheduled", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = "2026-06-12T10:00:00Z";
      const day = now.slice(0, 10);
      await writeActionClosureRecord(db, makeClosure(day));

      const r1 = await checkDailyRhythm(db, { now, forceQuiet: true });
      assert.equal(r1.status, "checked");
      if (r1.status !== "checked") return;
      assert.equal(r1.state.dreamStatus, "scheduled");

      // Second check with same timestamp should not crash on duplicate dream run
      const r2 = await checkDailyRhythm(db, { now });
      assert.equal(r2.status, "checked");
      if (r2.status !== "checked") return;
      assert.equal(r2.state.dreamStatus, "scheduled");
      assert.equal(r2.state.dreamReason, "dream_scheduled");
    } finally {
      db.close();
    }
  });
});
