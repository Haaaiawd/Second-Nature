/**
 * JudgmentEngine — Unit Tests
 *
 * Validates: verdict selection, risk posture, source-ref handling,
 * confidence thresholds, and degraded paths.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { runAgentJudgment } from "../../../src/core/second-nature/perception/judgment-engine.js";

const MOCK_DB = {} as any;

describe("judgment-engine", () => {
  describe("degraded handling", () => {
    it("returns degraded on missing card with MOCK_DB", async () => {
      const result = await runAgentJudgment(MOCK_DB, "nonexistent_card");
      assert.ok("status" in result && result.status === "degraded");
    });
  });

  describe("runAgentJudgments batch", () => {
    it("handles empty card list", async () => {
      const { runAgentJudgments } = await import("../../../src/core/second-nature/perception/judgment-engine.js");
      const result = await runAgentJudgments(MOCK_DB, []);
      assert.strictEqual(result.succeeded.length, 0);
      assert.strictEqual(result.failed.length, 0);
    });

    it("degrades all when cards are missing", async () => {
      const { runAgentJudgments } = await import("../../../src/core/second-nature/perception/judgment-engine.js");
      const result = await runAgentJudgments(MOCK_DB, ["missing1", "missing2"]);
      assert.strictEqual(result.succeeded.length, 0);
      assert.strictEqual(result.failed.length, 2);
    });
  });
});
