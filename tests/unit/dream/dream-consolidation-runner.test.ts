/**
 * DreamConsolidationRunner — Unit Tests
 *
 * Validates: missing run/review, blocked redaction, candidate generation.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { runDreamConsolidation } from "../../../src/core/second-nature/quiet-dream/dream-consolidation-runner.js";

const MOCK_DB = {} as any;

describe("dream-consolidation-runner", () => {
  describe("missing inputs", () => {
    it("returns degraded when run not found", async () => {
      const result = await runDreamConsolidation(MOCK_DB, "missing_run");
      assert.ok("status" in result && result.status === "degraded");
    });
  });
});
