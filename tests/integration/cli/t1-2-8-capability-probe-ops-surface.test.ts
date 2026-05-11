/**
 * T1.2.8 — `capability_probe` 接入 `createOpsRouter.dispatch` + workspace bridge。
 *
 * SN-CODE-03 根因：`probeHostCapability` 存在于 runtime 但未接入 bridge dispatch，
 * 导致 INT-S4 无法通过 ops surface 对照 tools.allow / tools.profile 做交叉验证。
 *
 * 验收标准：
 * A. Given fake host adapter（静态 unknown 适配器）
 *    When bridge / CLI 执行 `capability_probe`
 *    Then 返回与 probeHostCapability 一致的 JSON 子集，且非 `unknown_ops_command`
 * B. 返回 `ok: true` + `data.reportId`（UUID）+ `data.deliveryTarget` 字段
 * C. 无 observabilityDb 时命令仍可运行（skip persist 模式）
 * D. 有 observabilityDb 时命令持久化报告到 host_capability_reports 表
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
import { hostCapabilityReports } from "../../../src/observability/db/schema/host-capability-reports.js";

test("T1.2.8-A: capability_probe returns valid JSON subset, not unknown_ops_command", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("capability_probe");
  assert.ok(cmd, "capability_probe command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "capability_probe must return ok: true");
  assert.notEqual(
    (result as Record<string, unknown> & { error?: { code?: string } }).error?.code,
    "unknown_ops_command",
    "capability_probe must not be an unknown ops command",
  );

  await closeCliRuntimeDeps(deps);
});

test("T1.2.8-B: capability_probe returns reportId and deliveryTarget fields", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("capability_probe");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.ok(typeof data.reportId === "string" && data.reportId.length > 0, "must include reportId (UUID)");
  assert.ok("deliveryTarget" in data, "must include deliveryTarget field");
  assert.ok("pluginLoad" in data, "must include pluginLoad summary");
  assert.ok("heartbeatBridge" in data, "must include heartbeatBridge summary");
  assert.ok("heartbeatToolInvocation" in data, "must include heartbeatToolInvocation summary");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.8-C: capability_probe runs without observabilityDb (no-persist mode)", async () => {
  const stateDb = createStateDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("capability_probe");
  assert.ok(cmd, "capability_probe must be registered even without observabilityDb");

  // Should not throw — just skips persistence
  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "capability_probe must return ok: true without observabilityDb");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.8-D: capability_probe persists report to host_capability_reports when observabilityDb provided", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("capability_probe");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;

  // Verify persisted to DB
  const rows = await observabilityDb.db.select().from(hostCapabilityReports);
  assert.equal(rows.length, 1, "one capability report row must be persisted");
  assert.equal(rows[0]!.reportId, data.reportId, "DB row reportId must match returned reportId");

  await closeCliRuntimeDeps(deps);
});
