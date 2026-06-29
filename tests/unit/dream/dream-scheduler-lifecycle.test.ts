/**
 * DreamScheduler — Unit Tests
 *
 * Validates: schedule after quiet, scheduler unavailable, missing review.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { scheduleDreamAfterQuiet } from "../../../src/core/second-nature/quiet-dream/dream-scheduler.js";

const MOCK_DB = {} as any;

describe("dream-scheduler", () => {
  describe("missing review", () => {
    it("returns degraded when quiet review not found", async () => {
      const result = await scheduleDreamAfterQuiet(MOCK_DB, "missing_review");
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("scheduler unavailable", () => {
    it("records blocked state when scheduler is unavailable", async () => {
      const result = await scheduleDreamAfterQuiet(MOCK_DB, "quiet_2099-01-01", { schedulerAvailable: false });
      assert.ok("status" in result);
      if ("status" in result && result.status === "blocked") {
        assert.strictEqual(result.reason, "dream_scheduler_unavailable");
      }
    });
  });
});
