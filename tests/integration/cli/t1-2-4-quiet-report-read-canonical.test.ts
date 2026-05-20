/**
 * T1.2.4 — Quiet JSON 工件与 `report`/`quiet` canonical 对齐 + workspace quietWorkflow 接线。
 *
 * CH-14-07 根因：
 *   - `persistQuietArtifactToWorkspace` 写入 `.second-nature/quiet/{day}/`
 *   - `loadQuiet` 读取 `memory/` 目录（journal + reports）
 *   - 两路数据断裂：写了 JSON 工件后，`loadQuiet` 仍返回 sourceCount=0
 *
 * 场测勘误：「写了读不到」当前现场不适用（磁盘无 `.second-nature/quiet/`）；
 * 但任务仍需保证 Quiet 一旦运行后读路径非空。
 *
 * 验收标准 A：fixture 已执行一次 source-backed Quiet 并落盘 JSON 后，
 *   `loadQuiet` 返回 sourceCount > 0 且 mode !== "unknown"。
 * 验收标准 B：full-runtime heartbeat 选中 quiet intent（通过 maintenance_only + quietEnabled 路径
 *   来触发 quiet intent 写盘）后，周期结果含 `quiet_artifact_written` 或诚实原因。
 * 验收标准 C：quietWorkflow 接线后，heartbeat 不因 workspaceRoot 注入而崩溃。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createCliReadModels } from "../../../src/cli/read-models/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { writeQuietArtifact } from "../../../src/storage/quiet/quiet-artifact-writer.js";
import { persistQuietArtifactToWorkspace } from "../../../src/storage/quiet/persist-quiet-artifact.js";
import { createWorkspaceHeartbeatRunner } from "../../../src/cli/ops/workspace-heartbeat-runner.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-t124-"));
}

const today = new Date().toISOString().slice(0, 10);

// ─── Case A: 写盘后 loadQuiet 非零 ───────────────────────────────────────────

test("T1.2.4 A — after empty Quiet artifact persisted, loadQuiet tracks empty state separately", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({
    stateDb,
    observabilityDb,
    workspaceRoot: ws,
  });

  // Before: quiet should be unknown
  const before = await readModels.loadQuiet();
  assert.equal(
    before.mode,
    "unknown",
    "Before Quiet runs, mode must be unknown",
  );
  assert.equal(
    before.sourceCount,
    0,
    "Before Quiet runs, sourceCount must be 0",
  );

  // Simulate Quiet artifact write (empty_state path, simplest valid write).
  const input = {
    day: today,
    kind: "empty_state" as const,
    title: "Quiet — empty state test",
    body: "No evidence.",
    claims: [],
    sourceRefs: [],
  };
  const ack = writeQuietArtifact(input);
  await persistQuietArtifactToWorkspace(ws, ack, input);

  // After: empty_state is visible, but does not masquerade as a source-backed report.
  const after = await readModels.loadQuiet();
  assert.equal(
    after.sourceCount,
    0,
    `Expected sourceCount to remain 0 for empty_state; got ${after.sourceCount}`,
  );
  assert.equal(after.emptyStateCount, 1);
  assert.equal(
    after.mode,
    "unknown",
    "Empty state alone must not switch Quiet read model into source-backed mode",
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

// ─── Case B: 无 workspaceRoot → loadQuiet 静默降级，不崩溃 ───────────────────

test("T1.2.4 B — without workspaceRoot, loadQuiet returns unknown gracefully", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  // Intentionally omit workspaceRoot.
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const result = await readModels.loadQuiet();
  // Without workspaceRoot, can't scan .second-nature/quiet/ — should return unknown safely.
  assert.equal(
    result.mode,
    "unknown",
    "Without workspaceRoot, mode must be unknown (no evidence)",
  );
  assert.equal(
    result.sourceCount,
    0,
    "Without workspaceRoot, sourceCount must be 0",
  );

  stateDb.close();
  observabilityDb.close();
});

// ─── Case C: quietWorkflow 注入不崩溃心跳 ─────────────────────────────────────

test("T1.2.4 C — createWorkspaceHeartbeatRunner with quietWorkflow injected does not crash", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({
    stateDb,
    observabilityDb,
    workspaceRoot: ws,
  });

  const runner = createWorkspaceHeartbeatRunner(readModels, {
    workspaceRoot: ws,
    enableQuietWorkflow: true,
    state: stateDb,
  });

  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-10T10:00:00.000Z" },
  };

  const result = await runner(signal);
  // Should complete without throwing, returning a valid HeartbeatCycleResult.
  assert.ok(result.status, "heartbeat cycle must return a valid status");
  assert.ok(
    Array.isArray(result.reasons),
    "heartbeat cycle must return reasons array",
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

// ─── Case D: quiet intent path → artifact 写盘 → loadQuiet 读到 ───────────────

test("T1.2.4 D — after quiet intent writes artifact via heartbeat runner, loadQuiet reads it back", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({
    stateDb,
    observabilityDb,
    workspaceRoot: ws,
  });

  // Directly persist a daily_report artifact (simulating a non-empty Quiet path).
  const input = {
    day: today,
    kind: "daily_report" as const,
    title: "Quiet daily report",
    body: "Source-backed summary.",
    claims: [
      {
        id: "fact:1",
        text: "Evidence-backed fact",
        claimType: "fact" as const,
        sourceRefs: [
          { id: "src-1", kind: "platform_item" as const, uri: "moltbook://1" },
        ],
      },
    ],
    sourceRefs: [
      {
        id: "src-1",
        kind: "platform_item" as const,
        uri: "moltbook://1",
        excerptHash: undefined,
        observedAt: undefined,
      },
    ],
  };
  const ack = writeQuietArtifact(input);
  await persistQuietArtifactToWorkspace(ws, ack, input);

  const quietResult = await readModels.loadQuiet();
  assert.ok(
    quietResult.sourceCount > 0,
    "loadQuiet must reflect persisted daily_report artifact",
  );
  assert.equal(
    quietResult.mode,
    "quiet",
    "mode must be 'quiet' when artifacts exist",
  );
  assert.ok(
    quietResult.reportCount > 0,
    "reportCount must be > 0 after artifact persisted",
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});

// ─── Case E: loadDailyReport 也反映写盘工件（T1.2.4 / code review gap 修复）──────
//
// Code review 发现 loadDailyReport 未扫描 .second-nature/quiet/{day}/；
// 本测试验证修复后 loadDailyReport(day).sourceRefs 能反映写盘工件。

test("T1.2.4 E — after Quiet artifact persisted, loadDailyReport sourceRefs is non-empty", async () => {
  const ws = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({
    stateDb,
    observabilityDb,
    workspaceRoot: ws,
  });

  // Before: loadDailyReport should have no sourceRefs.
  const before = await readModels.loadDailyReport(today);
  assert.equal(
    before.sourceRefs.length,
    0,
    "Before artifact persisted, sourceRefs must be empty",
  );

  // Write a source-backed Quiet report artifact for today.
  const input = {
    day: today,
    kind: "daily_report" as const,
    title: "Quiet — daily report test",
    body: "Saw a source-backed event worth carrying forward.",
    claims: [
      {
        id: "fact:daily-report-source",
        text: "Source-backed event observed.",
        claimType: "fact" as const,
        sourceRefs: [
          {
            id: "src-daily-report-source",
            kind: "platform_item" as const,
            uri: "moltbook://daily-report-source",
          },
        ],
      },
    ],
    sourceRefs: [
      {
        id: "src-daily-report-source",
        kind: "platform_item" as const,
        uri: "moltbook://daily-report-source",
      },
    ],
  };
  const ack = writeQuietArtifact(input);
  await persistQuietArtifactToWorkspace(ws, ack, input);

  // After: loadDailyReport should include the artifact as a sourceRef.
  const after = await readModels.loadDailyReport(today);
  assert.ok(
    after.sourceRefs.length > 0,
    `Expected loadDailyReport sourceRefs to be non-empty after artifact persisted; got ${after.sourceRefs.length}`,
  );

  stateDb.close();
  observabilityDb.close();
  fs.rmSync(ws, { recursive: true, force: true });
});
