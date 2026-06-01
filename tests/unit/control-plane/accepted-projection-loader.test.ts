/**
 * AcceptedProjectionLoader — Unit Tests
 *
 * Validates: degraded handling on unreadable state.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { loadAcceptedProjections } from "../../../src/core/second-nature/control-plane/accepted-projection-loader.js";

const MOCK_DB = {} as any;

describe("accepted-projection-loader", () => {
  describe("degraded handling", () => {
    it("returns degraded on unreadable state with MOCK_DB", async () => {
      const result = await loadAcceptedProjections(MOCK_DB);
      assert.ok(!result.ok && result.degraded);
    });
  });
});
