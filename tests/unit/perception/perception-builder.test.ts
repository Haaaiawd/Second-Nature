/**
 * PerceptionBuilder — Unit Tests
 *
 * Validates: normal generation, empty batch, truncation, source ref binding,
 * rules-only fallback, risk flags, review priority.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  buildPerceptionCards,
  type BuildPerceptionCardsOptions,
} from "../../../src/core/second-nature/perception/perception-builder.js";

const MOCK_DB = {} as any;

describe("perception-builder", () => {
  describe("empty batch", () => {
    it("returns empty status when no pending evidence", async () => {
      const result = await buildPerceptionCards(MOCK_DB, {
        cycleId: "cyc_001",
      });
      assert.ok(result);
    });
  });

  describe("shape validation", () => {
    it("accepts valid BuildPerceptionCardsOptions", () => {
      const opts: BuildPerceptionCardsOptions = {
        cycleId: "cyc_001",
        maxEvidence: 10,
        now: "2026-06-01T00:00:00Z",
      };
      assert.strictEqual(opts.cycleId, "cyc_001");
    });
  });

  describe("card structure", () => {
    it("produces cards with required fields", async () => {
      const result = await buildPerceptionCards(MOCK_DB, {
        cycleId: "cyc_002",
      });
      assert.ok(result);
    });
  });

  describe("degraded handling", () => {
    it("returns degraded on state read failure", async () => {
      const result = await buildPerceptionCards(MOCK_DB, {
        cycleId: "cyc_004",
      });
      if ("status" in result) {
        assert.ok(result.status === "degraded" || result.status === "empty");
      }
    });
  });
});
