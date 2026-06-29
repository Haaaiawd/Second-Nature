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
import {
  writeActionClosureRecord,
  writeDreamConsolidationRun,
  updateDreamConsolidationRunStatus,
} from "../../../src/storage/v8-state-stores.js";
import { seedContentEvidence } from "../../shared/content-evidence-fixture.js";

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
      const day = "2026-06-05";
      await seedContentEvidence(db, { now: `${day}T08:00:00Z` });
      await writeActionClosureRecord(db, makeClosure(day));

      const result = await checkDailyRhythm(db, { now: `${day}T10:00:00Z`, forceQuiet: true });
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
      const day = "2026-06-05";
      await seedContentEvidence(db, { now: `${day}T08:00:00Z` });
      await writeActionClosureRecord(db, makeClosure(day));

      // First check
      const r1 = await checkDailyRhythm(db, { now: `${day}T10:00:00Z`, forceQuiet: true });
      assert.equal(r1.status, "checked");

      // Second check should not re-run
      const r2 = await checkDailyRhythm(db, { now: `${day}T11:00:00Z` });
      assert.equal(r2.status, "checked");
      if (r2.status === "checked") {
        assert.equal(r2.state.quietStatus, "completed");
        assert.equal(r2.state.dreamStatus, "completed");
      }
    } finally {
      db.close();
    }
  });

  it("enforces global 7-day Dream interval across Quiet review IDs", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Day 1: closure + Quiet + Dream completed
      const day1 = "2026-06-05";
      await seedContentEvidence(db, { now: `${day1}T08:00:00Z` });
      await writeActionClosureRecord(db, makeClosure(day1));
      const r1 = await checkDailyRhythm(db, { now: `${day1}T10:00:00Z`, forceQuiet: true });
      assert.equal(r1.status, "checked");
      if (r1.status === "checked") {
        assert.equal(r1.state.dreamStatus, "completed");
      }

      // Day 2 (within 7 days): another closure + Quiet, but Dream should honor interval
      const day2 = "2026-06-06";
      await seedContentEvidence(db, { now: `${day2}T08:00:00Z` });
      await writeActionClosureRecord(db, makeClosure(day2));
      const r2 = await checkDailyRhythm(db, { now: `${day2}T10:00:00Z`, forceQuiet: true });
      assert.equal(r2.status, "checked");
      if (r2.status === "checked") {
        assert.equal(r2.state.quietStatus, "completed");
        assert.equal(r2.state.dreamStatus, "completed");
        assert.equal(r2.state.dreamReason, "dream_interval_active");
      }
    } finally {
      db.close();
    }
  });
});
