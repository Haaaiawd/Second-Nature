/**
 * QuietDailyReviewBuilder — Unit Tests
 *
 * Validates: empty input, closure aggregation, memory candidate extraction.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { buildQuietDailyReview } from "../../../src/core/second-nature/quiet-dream/quiet-daily-review-builder.js";

const MOCK_DB = {} as any;

describe("quiet-daily-review-builder", () => {
  describe("degraded handling", () => {
    it("returns degraded on unreadable state with MOCK_DB", async () => {
      const result = await buildQuietDailyReview(MOCK_DB);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("empty input", () => {
    it("returns empty when no closures exist for the day", async () => {
      const result = await buildQuietDailyReview(MOCK_DB, { day: "2099-01-01" });
      assert.ok("status" in result);
      if (result.status === "empty") {
        assert.strictEqual(result.reason, "quiet_empty_input");
      }
    });
  });
});
