/**
 * Dream runner lifecycle tests (T-DQ.R.7)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeActionClosureRecord,
  writeDailyRhythmState,
  writeDreamConsolidationRun,
  writeQuietDailyReview,
  readDreamConsolidationRunById,
} from "../../../src/storage/v8-state-stores.js";
import { checkDailyRhythm } from "../../../src/core/second-nature/quiet-dream/daily-rhythm-scheduler.js";
import { seedContentEvidence } from "../../shared/content-evidence-fixture.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: SourceRef["family"] = "evidence"): SourceRef {
  return { uri: `sn://${family}/${id}`, family, id, redactionClass: "none", resolveStatus: "resolvable" };
}

describe("dream runner lifecycle", () => {
  it("schedules and completes Dream in the same rhythm check", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-15";
      await seedContentEvidence(db, { now: `${day}T08:00:00Z` });
      await writeActionClosureRecord(db, {
        id: `closure_${day}_1`,
        createdAt: `${day}T12:00:00Z`,
        cycleId: "cyc_001",
        status: "completed",
        sourceRefs: [makeRef(`closure_${day}_1`, "action_closure")],
        redactionClass: "none",
      });

      const result = await checkDailyRhythm(db, { now: `${day}T14:00:00Z` });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;
      assert.equal(result.state.quietStatus, "completed");
      assert.equal(result.state.dreamStatus, "completed");
      assert.equal(result.state.dreamReason, "dream_completed");
    } finally {
      db.close();
    }
  });

  it("repairs a stale scheduled run", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-15";
      const quietId = `quiet_${day}`;
      await writeQuietDailyReview(db, {
        id: quietId,
        createdAt: `${day}T12:00:00Z`,
        day,
        closureCount: 1,
        memoryCandidateCount: 0,
        sourceRefs: [makeRef(quietId, "quiet_review")],
        redactionClass: "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
          reviewSummary: "Day summary",
          contentStatus: "content_present",
          importanceSignals: ["one closure"],
          memoryCandidates: [],
          sections: [],
        }),
      });

      await writeDreamConsolidationRun(db, {
        id: `dream_${quietId}_stale`,
        createdAt: "2026-06-15T10:00:00Z", // older than 5 minute stale threshold
        quietReviewId: quietId,
        status: "scheduled",
        sourceRefs: [makeRef(`dream_${quietId}_stale`, "dream_run")],
        redactionClass: "none",
        payloadJson: JSON.stringify({ scheduledAt: "2026-06-15T10:00:00Z" }),
      });

      await writeDailyRhythmState(db, {
        id: `rhythm_${day}`,
        day,
        quietStatus: "completed",
        dreamStatus: "scheduled",
        quietReason: "quiet_completed",
        dreamReason: "dream_scheduled",
        sourceRefs: [makeRef(`rhythm_${day}`, "dream_run")],
        payloadJson: JSON.stringify({}),
        updatedAt: `${day}T12:00:00Z`,
      });

      const result = await checkDailyRhythm(db, { now: `${day}T14:00:00Z` });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;
      assert.equal(result.state.dreamStatus, "completed");

      const staleRun = await readDreamConsolidationRunById(db, `dream_${quietId}_stale`);
      assert.equal(staleRun.row?.status, "completed");
    } finally {
      db.close();
    }
  });

  it("does not schedule a new Dream within the 7-day interval", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = "2026-06-15";
      const quietId = `quiet_${day}`;

      await writeDreamConsolidationRun(db, {
        id: `dream_${quietId}_recent`,
        createdAt: `${day}T11:00:00Z`,
        quietReviewId: quietId,
        status: "completed",
        reason: "dream_completed",
        sourceRefs: [makeRef(`dream_${quietId}_recent`, "dream_run")],
        redactionClass: "none",
        payloadJson: JSON.stringify({ scheduledAt: `${day}T11:00:00Z`, consolidatedAt: `${day}T11:01:00Z` }),
      });

      await seedContentEvidence(db, { now: `${day}T08:00:00Z` });
      await writeActionClosureRecord(db, {
        id: `closure_${day}_1`,
        createdAt: `${day}T12:00:00Z`,
        cycleId: "cyc_001",
        status: "completed",
        sourceRefs: [makeRef(`closure_${day}_1`, "action_closure")],
        redactionClass: "none",
      });

      const result = await checkDailyRhythm(db, { now: `${day}T14:00:00Z` });
      assert.equal(result.status, "checked");
      if (result.status !== "checked") return;
      assert.equal(result.state.quietStatus, "completed");
      assert.equal(result.state.dreamStatus, "completed");
      assert.equal(result.state.dreamReason, "dream_interval_active");
    } finally {
      db.close();
    }
  });
});
