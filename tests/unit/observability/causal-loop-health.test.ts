/**
 * CausalLoopHealth — Unit Tests
 *
 * Validates: no-data, degraded handling.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { assembleLoopStatus } from "../../../src/observability/causal-loop-health.js";

const MOCK_DB = {} as any;

describe("causal-loop-health", () => {
  describe("degraded handling", () => {
    it("returns degraded on unreadable state with MOCK_DB", async () => {
      const result = await assembleLoopStatus(MOCK_DB);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });
});
