/**
 * Heartbeat Rhythm Advance — API Tests (T-CP.R.3)
 *
 * Validates: heartbeat_check with v8 spine enabled auto-advances daily rhythm
 * and exposes rhythm state in the surface result.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { heartbeatCheck } from "../../../src/cli/ops/heartbeat-surface.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { readDailyRhythmStateByDay } from "../../../src/storage/v8-state-stores.js";

describe("heartbeat-rhythm-advance API", () => {
  it("v8 spine enabled advances daily rhythm and exposes rhythm state", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      const result = await heartbeatCheck({
        runtimeAvailable: true,
        readModels: {} as any,
        state: db,
        workspaceRoot: "/test",
        v8SpineEnabled: true,
        scopeHint: "user_task",
        timestamp: now,
      });

      assert.ok(result.ok, "heartbeat should succeed");
      assert.ok(result.v8Spine, "v8Spine should be present");
      assert.ok(result.v8Spine?.rhythmState, "v8Spine should carry rhythm state");
      assert.ok(
        ["completed", "skipped"].includes(result.v8Spine?.rhythmState?.quietStatus ?? ""),
        "quiet should be completed or skipped"
      );
      assert.ok(
        ["completed", "blocked"].includes(result.v8Spine?.rhythmState?.dreamStatus ?? ""),
        "dream should be completed or blocked"
      );

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(!rhythm.degraded, "rhythm read should not degrade");
      assert.ok(rhythm.row, "daily rhythm state should be persisted");
    } finally {
      db.close();
    }
  });

  it("v8 spine disabled does not advance daily rhythm", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      const result = await heartbeatCheck({
        runtimeAvailable: true,
        readModels: {} as any,
        state: db,
        workspaceRoot: "/test",
        v8SpineEnabled: false,
        scopeHint: "user_task",
        timestamp: now,
      });

      assert.ok(result.ok, "heartbeat should succeed");
      assert.strictEqual(result.v8Spine, undefined, "v8Spine should not be present");

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(!rhythm.row, "daily rhythm state should not be created by v7 path");
    } finally {
      db.close();
    }
  });
});
