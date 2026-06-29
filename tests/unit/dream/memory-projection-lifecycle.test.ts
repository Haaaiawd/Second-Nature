/**
 * MemoryProjectionLifecycle — Unit Tests
 *
 * Validates: accept with source refs missing, degraded handling.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  acceptMemoryProjection,
  rejectMemoryProjection,
  retireMemoryProjection,
} from "../../../src/core/second-nature/quiet-dream/memory-projection-lifecycle.js";

const MOCK_DB = {} as any;

describe("memory-projection-lifecycle", () => {
  describe("accept", () => {
    it("rejects acceptance without source refs", async () => {
      const result = await acceptMemoryProjection(MOCK_DB, "cand_1", "topic_test", "memory text", []);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "blocked");
    });

    it("returns degraded on unreadable state", async () => {
      const result = await acceptMemoryProjection(MOCK_DB, "cand_1", "topic_test", "memory text", [
        { uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" },
      ]);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("reject", () => {
    it("returns degraded on unreadable state", async () => {
      const result = await rejectMemoryProjection(MOCK_DB, "proj_1", "cand_1", "topic_test", [
        { uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" },
      ]);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("retire", () => {
    it("returns degraded on unreadable state", async () => {
      const result = await retireMemoryProjection(MOCK_DB, "proj_1", "cand_1", "topic_test", [
        { uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" },
      ]);
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });
});
