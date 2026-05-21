/**
 * T2.2.2 — Workspace SnapshotInputs 并入 bounded life evidence。
 *
 * CH-14-01 根因：`loadSnapshotInputsForWorkspaceHeartbeat` 未调用 `loadLifeEvidenceSnapshot`，
 * 导致 planner/guard 需要 source refs 的候选路径拿到空快照。
 *
 * 验收标准：
 * A. fixture workspace 有 life evidence index 行时，full-runtime heartbeat_check 运行后
 *    SnapshotInputs 中 life evidence 计数或 refs 至少一项反映 DB 真值。
 * B. 无数据时，`lifeEvidenceEmptyReason` 为 `no_sources` 或 `state_unavailable`，
 *    不得伪造 refs。
 * C. 无 state wired 时降级为 `lifeEvidenceEmptyReason: state_unavailable`，
 *    不崩溃心跳循环。
 *
 * 验证路径：通过 `loadSnapshotInputsForWorkspaceHeartbeat` 直接调用 + 集成路径验证。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSnapshotInputsForWorkspaceHeartbeat } from "../../../src/cli/ops/workspace-heartbeat-runner.js";
import { appendLifeEvidence } from "../../../src/storage/life-evidence/append-life-evidence.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createCliReadModels } from "../../../src/cli/read-models/index.js";
import { createCliRuntimeDeps, createCommandRouter, closeCliRuntimeDeps } from "../../../src/cli/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-t222-"));
}

// ─── Case A: DB 有 life evidence → SnapshotInputs 携带非空 refs ──────────────

test("T2.2.2 A — with DB evidence, loadSnapshotInputsForWorkspaceHeartbeat populates lifeEvidenceRefs", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  // Write one life evidence entry so DB has a real row.
  await appendLifeEvidence(stateDb, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "platform_browse",
    platformId: "moltbook",
    summary: "Browsed moltbook feed",
    sourceRefs: [{ id: "src-A1", kind: "platform_item", uri: "moltbook://item/1" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  const inputs = await loadSnapshotInputsForWorkspaceHeartbeat(readModels, {
    state: stateDb,
    workspaceRoot: ws,
  });

  // At least one ref should be populated from DB truth.
  assert.ok(
    (inputs.lifeEvidenceRefs?.length ?? 0) > 0 || (inputs.platformEventCount ?? 0) > 0,
    `Expected life evidence refs or platformEventCount > 0 from DB truth; got refs=${inputs.lifeEvidenceRefs?.length ?? 0}, platformEventCount=${inputs.platformEventCount ?? 0}`,
  );
  // Must not carry state_unavailable when state was provided and worked.
  assert.notEqual(
    inputs.lifeEvidenceEmptyReason,
    "state_unavailable",
    "lifeEvidenceEmptyReason must not be state_unavailable when state was successfully loaded",
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

// ─── Case B: DB 为空 → emptyReason 为 no_sources，不伪造 refs ────────────────

test("T2.2.2 B — empty DB, loadSnapshotInputsForWorkspaceHeartbeat reports no_sources without faking refs", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const inputs = await loadSnapshotInputsForWorkspaceHeartbeat(readModels, {
    state: stateDb,
    workspaceRoot: ws,
  });

  // No evidence in DB → refs should be empty.
  assert.equal(
    (inputs.lifeEvidenceRefs?.length ?? 0) + (inputs.platformEventCount ?? 0) + (inputs.workEventCount ?? 0),
    0,
    "Must not fabricate evidence refs when DB is empty",
  );
  // Empty reason should be no_sources (state was available but had no rows).
  assert.equal(
    inputs.lifeEvidenceEmptyReason,
    "no_sources",
    "lifeEvidenceEmptyReason must be no_sources when state is available but empty",
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

// ─── Case C: 无 state wired → 降级为 state_unavailable，不崩溃 ────────────────

test("T2.2.2 C — no state wired, loadSnapshotInputsForWorkspaceHeartbeat degrades gracefully", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  // Intentionally omit state + workspaceRoot.
  const inputs = await loadSnapshotInputsForWorkspaceHeartbeat(readModels);

  assert.equal(
    inputs.lifeEvidenceEmptyReason,
    "state_unavailable",
    "lifeEvidenceEmptyReason must be state_unavailable when no state is wired",
  );
  // Must not crash — heartbeat cycle must still get valid inputs.
  assert.ok(inputs.mode, "mode field must be populated even without state");
  assert.ok(inputs.currentWindowId, "currentWindowId must be populated even without state");

  stateDb.close();
  observabilityDb.close();
});

// ─── Case D: 集成路径 — full-runtime heartbeat_check 不因 evidence load 崩溃 ──

test("T2.2.2 D — full-runtime heartbeat_check with state wired completes without error", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");

  // Write evidence so the path exercises non-empty branch.
  await appendLifeEvidence(stateDb, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "work_progress",
    platformId: "evomap",
    summary: "Task discovered on EvoMap",
    sourceRefs: [{ id: "src-D1", kind: "connector_result", uri: "evomap://task/42" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("heartbeat_check");
  assert.ok(cmd, "heartbeat_check command must be registered");

  const out = (await cmd!.execute({ timestamp: "2026-05-10T10:00:00.000Z" })) as {
    ok: boolean;
    surfaceMode: string;
    status: string;
  };
  assert.equal(out.ok, true, "heartbeat_check must succeed with state wired");
  assert.equal(out.surfaceMode, "workspace_full_runtime", "must run workspace full runtime path");

  closeCliRuntimeDeps(deps);
  fs.rmSync(ws, { recursive: true, force: true });
});
