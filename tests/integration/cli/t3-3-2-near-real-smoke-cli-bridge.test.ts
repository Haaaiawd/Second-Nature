/**
 * T3.3.2 — `near_real_smoke` ops CLI/bridge 命令包装。
 *
 * SN-CODE-05 根因：`runNearRealConnectorSmoke` 存在于 connectors 层但未接入 ops surface，
 * 导致 operator 无法通过 `second_nature_ops({ command: "near_real_smoke" })` 触发哨兵探测。
 *
 * 验收标准：
 * A. Given workspace deps 可用（stateDb + observabilityDb + workspaceRoot）
 *    When CLI 执行 `near_real_smoke`
 *    Then 返回 `ok: true` + `data.taskClaimDryRunOk === true`，非 `unknown_ops_command`
 * B. 缺少 deps 时，返回 `ok: false` + 诚实错误码 `NEAR_REAL_SMOKE_DEPS_UNAVAILABLE`（非 throw）
 * C. 命令已注册（不返回 undefined），名称为 `near_real_smoke`
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createOpsRouter } from "../../../src/cli/ops/ops-router.js";

test("T3.3.2-A: near_real_smoke returns ok:true with smoke result data", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-t332-"));
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("near_real_smoke");
  assert.ok(cmd, "near_real_smoke command must be registered");

  // createCommandRouter uses process.cwd() for workspaceRoot; the smoke just needs a dir.
  // Override via opsRouter dispatch directly to pass the temp workspace.
  const opsRouter = createOpsRouter({
    runtimeAvailable: false,
    readModels: deps.readModels,
    state: stateDb,
    observabilityDb,
    workspaceRoot: ws,
  });
  const result = (await opsRouter.dispatch("near_real_smoke")) as Record<string, unknown>;
  assert.equal(result.ok, true, "near_real_smoke must return ok: true");
  const data = result.data as Record<string, unknown>;
  assert.equal(data.taskClaimDryRunOk, true, "taskClaimDryRunOk must be true");
  assert.ok("feedReadEvidenceId" in data, "must include feedReadEvidenceId");
  assert.ok("workDiscoverEvidenceId" in data, "must include workDiscoverEvidenceId");

  await closeCliRuntimeDeps(deps);
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

test("T3.3.2-B: near_real_smoke returns honest error when deps unavailable", async () => {
  // OpsRouter without state/observabilityDb/workspaceRoot
  const opsRouter = createOpsRouter({
    runtimeAvailable: false,
  });
  const result = (await opsRouter.dispatch("near_real_smoke")) as Record<string, unknown>;
  assert.equal(result.ok, false, "must return ok: false when deps missing");
  const err = result.error as Record<string, unknown>;
  assert.equal(err.code, "NEAR_REAL_SMOKE_DEPS_UNAVAILABLE", "must return NEAR_REAL_SMOKE_DEPS_UNAVAILABLE");
});

test("T3.3.2-C: near_real_smoke command is registered in CLI commands list", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("near_real_smoke");
  assert.ok(cmd, "near_real_smoke command must be findable by name");
  assert.equal(cmd!.name, "near_real_smoke");

  await closeCliRuntimeDeps(deps);
});
