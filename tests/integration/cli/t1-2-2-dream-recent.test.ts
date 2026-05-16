/**
 * T1.2.2 — CLI `dream:recent` 命令最小闭环。
 *
 * Acceptance:
 * A. 空 audit store 时返回 ok:true + { totalRuns: 0, runs: [] }，不含 notImplemented 占位。
 * B. 有 dream.trace 事件时返回正确结构的 DreamRecentReadModel。
 * C. limit 参数有效限制返回条数。
 * D. 命令通过 createCommandRouter 正确注册并可解析。
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
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";

test("T1.2.2-A: dream:recent returns ok:true with honest empty when store is empty", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("dream:recent");
  assert.ok(cmd, "dream:recent command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "dream:recent must return ok: true");
  assert.ok(
    !JSON.stringify(result).includes("Implementation lands in later Wave tasks"),
    "must not return notImplemented placeholder",
  );

  const data = result.data as Record<string, unknown>;
  assert.ok(data, "must include data");
  assert.equal(data.totalRuns, 0, "empty store must return totalRuns: 0");
  assert.deepEqual(data.runs, [], "empty store must return runs: []");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.2-B: dream:recent returns correct DreamRecentReadModel shape", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  recorder.recordDreamTrace({
    traceId: "dream:trace-cli-001",
    runId: "run-cli-001",
    startedAt: "2026-05-16T08:00:00Z",
    finishedAt: "2026-05-16T08:01:00Z",
    durationMs: 60000,
    inputCounts: { evidence: 3, chronicle: 2, memoryEntries: 5 },
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb, livedExperienceAuditStore: store });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("dream:recent");
  assert.ok(cmd);

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  assert.equal(data.totalRuns, 1);

  const runs = data.runs as Array<Record<string, unknown>>;
  assert.equal(runs.length, 1);

  const run = runs[0]!;
  assert.equal(run.traceId, "dream:trace-cli-001");
  assert.equal(run.runId, "run-cli-001");
  assert.equal(run.durationMs, 60000);
  assert.deepEqual(run.inputCounts, { evidence: 3, chronicle: 2, memoryEntries: 5 });
  assert.equal(run.lifecycleStatus, "completed");
  assert.ok(typeof run.createdAt === "string");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.2-C: dream:recent respects limit parameter", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  for (let i = 0; i < 5; i++) {
    recorder.recordDreamTrace({
      traceId: `dream:trace-limit-${i}`,
      runId: `run-limit-${i}`,
      startedAt: "2026-05-16T08:00:00Z",
      finishedAt: `2026-05-16T0${i + 1}:00:00Z`,
      durationMs: 1000,
      inputCounts: { evidence: 1, chronicle: 0, memoryEntries: 0 },
    });
  }

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb, livedExperienceAuditStore: store });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("dream:recent");
  assert.ok(cmd);

  const result = (await cmd!.execute({ limit: 2 })) as Record<string, unknown>;
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  assert.equal(data.totalRuns, 5); // totalRuns reflects all events
  assert.equal((data.runs as unknown[]).length, 2); // but only 2 returned

  await closeCliRuntimeDeps(deps);
});

test("T1.2.2-D: dream:recent command is registered in createCommandRouter", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });

  const cmd = router.resolve("dream:recent");
  assert.ok(cmd, "dream:recent must be registered in command router");
  assert.ok(cmd!.description.toLowerCase().includes("dream"), "description must mention dream");

  await closeCliRuntimeDeps(deps);
});
