/**
 * T-ROS.R.11 — normalizeEnvelopeResult error preservation test.
 *
 * Core logic: verify that the ops router preserves raw error codes
 * from non-envelope results instead of replacing them with generic
 * OPS_RESULT_NOT_AN_ENVELOPE.
 *
 * Design authority: `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §2`
 * Task: T-ROS.R.11 (Wave 119 / CH-45)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createOpsRouter, type RuntimeOpsEnvelope } from "../../../src/cli/ops/ops-router.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";

describe("T-ROS.R.11 normalizeEnvelopeResult error preservation", () => {
  it("unknown command returns specific error code, not generic OPS_RESULT_NOT_AN_ENVELOPE", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const router = createOpsRouter({
        runtimeAvailable: true,
        state: db,
        workspaceRoot: "/test",
      });

      const result = (await router.dispatch("nonexistent_command_xyz", {})) as RuntimeOpsEnvelope;

      assert.strictEqual(result.ok, false);
      assert.ok(result.error?.code, "error.code must be present");
      // The error code should NOT be the generic OPS_RESULT_NOT_AN_ENVELOPE
      assert.notStrictEqual(
        result.error?.code,
        "OPS_RESULT_NOT_AN_ENVELOPE",
        "error.code should not be generic for unknown command",
      );
    } finally {
      db.close();
    }
  });
});
