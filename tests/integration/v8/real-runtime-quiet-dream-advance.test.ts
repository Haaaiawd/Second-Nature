/**
 * Real Runtime Quiet/Dream Advance — Integration Test (T-CP.R.3 / T-DQ.R.5)
 *
 * Validates: real heartbeat advances closure into daily rhythm state,
 * QuietDailyReview, and Dream scheduling/blocking without manual trigger.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  readActionClosuresByCycle,
  readDailyRhythmStateByDay,
  readQuietDailyReviewById,
  readLoopStageEventsByCycle,
} from "../../../src/storage/v8-state-stores.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: import("../../../src/shared/types/v8-contracts.js").SourceRefFamily = "evidence"): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

describe("real-runtime-quiet-dream-advance", () => {
  it("heartbeat auto-advances closure → Quiet completed → Dream scheduled", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      await writeEvidenceItem(db, {
        id: "ev_qd_001",
        createdAt: now,
        platformId: "moltbook",
        contentHash: "hash001",
        observedAt: now,
        sourceRefs: [makeRef("ev_qd_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      assert.ok(!("status" in result && result.status === "degraded"), "heartbeat should not degrade");
      const r = result as { cycleId: string; cycleSequence: number; rhythmState?: { quietStatus: string; dreamStatus: string } };

      // Closure recorded
      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure");

      // Daily rhythm stage event recorded
      const events = await readLoopStageEventsByCycle(db, r.cycleId);
      assert.ok(events.rows.some((e) => e.stage === "quiet" && e.status === "completed"), "quiet stage event");

      // Rhythm state persisted
      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(!rhythm.degraded, "rhythm read should not degrade");
      assert.ok(rhythm.row);
      assert.equal(rhythm.row?.quietStatus, "completed");
      assert.equal(rhythm.row?.dreamStatus, "scheduled");

      // QuietDailyReview written
      const quietId = `quiet_${day}`;
      const quiet = await readQuietDailyReviewById(db, quietId);
      assert.ok(!quiet.degraded, "quiet read should not degrade");
      assert.ok(quiet.row);
      assert.ok((quiet.row?.closureRefsJson ?? "[]").includes("sn://closure"), "review has closure refs");

      // Dream scheduled — rhythm state is the durable evidence
      assert.equal(rhythm.row?.dreamStatus, "scheduled");

      // Result also carries rhythm state
      assert.ok(r.rhythmState);
      assert.equal(r.rhythmState?.quietStatus, "completed");
      assert.equal(r.rhythmState?.dreamStatus, "scheduled");
    } finally {
      db.close();
    }
  });

  it("no-evidence heartbeat still writes closure and advances rhythm", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      assert.ok(!("status" in result && result.status === "degraded"), "heartbeat should not degrade");
      const r = result as { cycleId: string };

      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "no-action closure written");

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(rhythm.row);
      assert.ok(["completed", "skipped"].includes(rhythm.row?.quietStatus ?? ""), "quiet completed or skipped");
      assert.ok(["scheduled", "blocked"].includes(rhythm.row?.dreamStatus ?? ""), "dream scheduled or blocked");
    } finally {
      db.close();
    }
  });

  it("multiple heartbeats on same day do not duplicate Quiet review", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = "2026-06-12T10:00:00Z";
      const day = now.slice(0, 10);

      await runHeartbeatCycle(db, { workspaceRoot: "/test", requestedAt: now, trigger: "manual" });
      await runHeartbeatCycle(db, { workspaceRoot: "/test", requestedAt: `${day}T11:00:00Z`, trigger: "manual" });

      const quiet = await readQuietDailyReviewById(db, `quiet_${day}`);
      assert.ok(quiet.row);

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.equal(rhythm.row?.quietStatus, "completed");
    } finally {
      db.close();
    }
  });
});
