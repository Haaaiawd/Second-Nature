/**
 * INT-S5 — Loop Status Integration Smoke
 *
 * Validates: loop_status command routing, envelope shape, and degraded handling
 * through the ops-router surface without requiring a live database.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createOpsRouter } from "../../../src/cli/ops/ops-router.js";

describe("INT-S5: loop_status integration", () => {
  describe("ops-router loop_status command", () => {
    it("returns degraded envelope when state is unavailable", async () => {
      const router = createOpsRouter({
        runtimeAvailable: true,
        state: undefined,
      });
      const result = await router.dispatch("loop_status", {});
      assert.ok(typeof result === "object" && result !== null);
      assert.strictEqual((result as any).ok, false);
      assert.strictEqual((result as any).command, "loop_status");
      assert.ok((result as any).error?.code);
    });

    it("returns RuntimeOpsEnvelope with correct surfaceMode", async () => {
      const router = createOpsRouter({
        runtimeAvailable: true,
        state: undefined,
      });
      const result = await router.dispatch("loop_status", {});
      assert.ok(typeof result === "object" && result !== null);
      assert.strictEqual((result as any).surfaceMode, "cli");
      assert.ok((result as any).generatedAt);
    });
  });
});
