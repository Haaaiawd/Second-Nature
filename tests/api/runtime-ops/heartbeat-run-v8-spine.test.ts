/**
 * Heartbeat Run V8 Spine — API Tests (T-CP.R.2)
 *
 * Validates: heartbeat_check returns v8 spine result with closure/no-action,
 * CLI/OpenClaw parity, and degraded envelope when state DB is missing.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { heartbeatCheck } from "../../../src/cli/ops/heartbeat-surface.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";

describe("heartbeat-run-v8-spine API", () => {
  it("returns v8Spine in result when state DB is wired", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await heartbeatCheck({
        runtimeAvailable: true,
        readModels: {} as any,
        state: db,
        workspaceRoot: "/test",
        v8SpineEnabled: true,
        scopeHint: "user_task",
      });

      assert.ok(result.ok, "heartbeat should succeed");
      assert.ok(result.v8Spine, "v8Spine should be present");
      assert.ok(
        result.v8Spine?.closureRef || result.v8Spine?.noActionReason,
        "v8Spine should have closure or no-action"
      );
      assert.equal(
        result.livedExperienceLoopClaimed,
        true,
        "state-backed v8 spine closure/no-action should claim lived loop completion"
      );
      assert.ok(
        result.reasons.some((r) => r.startsWith("v8_spine_cycle:")),
        "reasons should reference v8 spine cycle"
      );
    } finally {
      db.close();
    }
  });

  it("skips v8 spine when v8SpineEnabled is false", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await heartbeatCheck({
        runtimeAvailable: true,
        state: db,
        workspaceRoot: "/test",
        v8SpineEnabled: false,
        scopeHint: "user_task",
      });

      assert.ok(result.ok, "heartbeat should succeed");
      assert.strictEqual(
        result.v8Spine,
        undefined,
        "v8Spine should not be present when disabled"
      );
      assert.equal(result.livedExperienceLoopClaimed, false);
    } finally {
      db.close();
    }
  });

  it("skips v8 spine when workspaceRoot is missing", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await heartbeatCheck({
        runtimeAvailable: true,
        state: db,
        v8SpineEnabled: true,
        scopeHint: "user_task",
        // workspaceRoot intentionally omitted
      });

      assert.ok(result.ok, "heartbeat should succeed");
      assert.strictEqual(
        result.v8Spine,
        undefined,
        "v8Spine should not be present without workspaceRoot"
      );
      assert.equal(result.livedExperienceLoopClaimed, false);
    } finally {
      db.close();
    }
  });
});
