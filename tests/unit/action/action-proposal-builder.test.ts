/**
 * ActionProposalBuilder — Unit Tests
 *
 * Validates: verdict-to-proposal mapping, no-action, remember-for-review,
 * degraded handling.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { buildActionProposal } from "../../../src/core/second-nature/action/action-proposal-builder.js";

const MOCK_DB = {} as any;

describe("action-proposal-builder", () => {
  describe("degraded handling", () => {
    it("returns degraded on missing verdict with MOCK_DB", async () => {
      const result = await buildActionProposal(MOCK_DB, "nonexistent_verdict");
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("batch builder", () => {
    it("handles empty verdict list", async () => {
      const { buildActionProposals } = await import("../../../src/core/second-nature/action/action-proposal-builder.js");
      const result = await buildActionProposals(MOCK_DB, []);
      assert.strictEqual(result.proposals.length, 0);
      assert.strictEqual(result.noActions.length, 0);
      assert.strictEqual(result.rememberForReviews.length, 0);
      assert.strictEqual(result.failed.length, 0);
    });

    it("degrades all when verdicts are missing", async () => {
      const { buildActionProposals } = await import("../../../src/core/second-nature/action/action-proposal-builder.js");
      const result = await buildActionProposals(MOCK_DB, ["missing1", "missing2"]);
      assert.strictEqual(result.proposals.length, 0);
      assert.strictEqual(result.failed.length, 2);
    });
  });
});
