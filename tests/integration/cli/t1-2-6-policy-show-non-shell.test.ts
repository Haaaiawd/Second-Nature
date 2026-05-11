/**
 * T1.2.6 — CLI `policy show` 非空壳实现。
 *
 * SN-CODE-01 根因：`createCliCommands` 中 `policy` 的 `action !== "set"` 路径
 * 返回占位 `notImplemented`，operator 无法读取当前节律策略。
 *
 * 验收标准：
 * A. `action === "show"`（或默认）时，返回 `ok: true` + 结构化 `data`，
 *    且不含「Implementation lands in later Wave tasks」占位文案。
 * B. 无持久化 policy 行时，返回合理默认值（quietEnabled、socialDailyLimit 等字段存在）。
 * C. 持久化 policy 行后，返回写入的值。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

test("T1.2.6-A: policy show returns ok:true with structured data (default)", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("policy");
  assert.ok(cmd, "policy command must be registered");

  const result = (await cmd!.execute({ action: "show" })) as Record<string, unknown>;
  assert.equal(result.ok, true, "policy show must return ok: true");
  const data = result.data as Record<string, unknown>;
  assert.ok(data, "policy show must include data");
  // Must not be the notImplemented shell message
  assert.ok(
    !JSON.stringify(result).includes("Implementation lands in later Wave tasks"),
    "policy show must not return notImplemented placeholder",
  );

  await closeCliRuntimeDeps(deps);
});

test("T1.2.6-B: policy show returns required snapshot fields with defaults", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("policy");

  // Default (no action argument = defaults to show)
  const result = (await cmd!.execute({})) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  // Required fields from RhythmPolicySnapshot
  assert.ok("snapshotId" in data, "must include snapshotId");
  assert.ok("generatedAt" in data, "must include generatedAt");
  assert.ok("quietEnabled" in data, "must include quietEnabled");
  assert.ok("socialDailyLimit" in data, "must include socialDailyLimit");
  assert.ok("outreachDailyBudget" in data, "must include outreachDailyBudget");
  assert.ok("updatedAt" in data, "must include updatedAt");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.6-C: policy show reflects persisted policy after set", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("policy");
  assert.ok(cmd, "policy command must be registered");

  // Set policy first
  const setResult = (await cmd!.execute({
    action: "set",
    platformId: "workspace",
    socialDailyLimit: 3,
    quietEnabled: false,
  })) as Record<string, unknown>;
  assert.equal(setResult.ok, true, "policy set must succeed");

  // Now show — should reflect persisted values
  const showResult = (await cmd!.execute({ action: "show" })) as Record<string, unknown>;
  assert.equal(showResult.ok, true);
  const data = showResult.data as Record<string, unknown>;
  assert.equal(data.quietEnabled, false, "show must reflect persisted quietEnabled=false");
  assert.equal(data.socialDailyLimit, 3, "show must reflect persisted socialDailyLimit=3");

  await closeCliRuntimeDeps(deps);
});
