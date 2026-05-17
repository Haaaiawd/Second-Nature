/**
 * T1.2.6 — CLI `status:v6` v6 status aggregate command 最小闭环。
 *
 * Acceptance:
 * A. 全空时返回 ok:true，三个 v6 section 均有 nothing_yet 哨兵值。
 * B. 有 narrative、dream、cycle 数据时返回各自 section 的有效聚合。
 * C. 某个 section 无数据时返回 nothing_yet，不伪造数据。
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
import { createNarrativeStateStore } from "../../../src/storage/narrative/narrative-state-store.js";

test("T1.2.6-A: status:v6 returns ok:true with nothing_yet sections when all stores empty", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("status:v6");
  assert.ok(cmd, "status:v6 command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "status:v6 must return ok: true");
  assert.ok(
    !JSON.stringify(result).includes("Implementation lands in later Wave tasks"),
    "must not return notImplemented placeholder",
  );

  const data = result.data as Record<string, unknown>;
  assert.ok(data, "must include data");

  // Narrative section: nothing_yet
  const narrative = data.narrative as Record<string, unknown>;
  assert.ok(narrative, "must include narrative section");
  assert.equal(narrative.status, "nothing_yet", "empty store => narrative.status nothing_yet");
  assert.equal(narrative.groundingStatus, "blocked");
  assert.equal(narrative.sourceRefCount, 0);

  // Dream section: nothing_yet
  const dream = data.dream as Record<string, unknown>;
  assert.ok(dream, "must include dream section");
  assert.equal(dream.status, "nothing_yet", "empty audit store => dream.status nothing_yet");
  assert.equal(dream.totalRuns, 0);
  assert.equal(dream.recentRunCount, 0);

  // Cycle section: nothing_yet
  const cycles = data.cycles as Record<string, unknown>;
  assert.ok(cycles, "must include cycles section");
  assert.equal(cycles.status, "nothing_yet", "empty audit store => cycles.status nothing_yet");
  assert.equal(cycles.totalCycles, 0);
  assert.deepEqual(cycles.dimensions, []);

  // Base fields must still be present
  assert.ok(data.runtime, "must include runtime section");
  assert.ok(data.rhythm, "must include rhythm section");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.6-B: status:v6 returns full v6 aggregate when narrative, dream, and cycle data exist", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  // Seed NarrativeState
  const narrativeStore = createNarrativeStateStore(stateDb);
  await narrativeStore.updateNarrativeState({
    narrativeId: "default",
    revision: 3,
    focus: "Wave 32 completion",
    progress: ["T1.2.1 done", "T1.2.6 in progress"],
    nextIntent: "Run tests",
    confidence: 0.8,
    sourceRefs: [{ sourceId: "s-001", kind: "heartbeat" }, { sourceId: "s-002", kind: "report" }],
    unsupportedClaims: [],
    status: "active",
    updatedAt: "2026-05-16T12:00:00Z",
  });

  // Seed DreamTrace events
  recorder.recordDreamTrace({
    traceId: "dream:v6-agg-001",
    runId: "run-v6-001",
    startedAt: "2026-05-16T10:00:00Z",
    finishedAt: "2026-05-16T10:01:00Z",
    durationMs: 60000,
    inputCounts: { evidence: 5, chronicle: 3, memoryEntries: 8 },
  });
  recorder.recordDreamTrace({
    traceId: "dream:v6-agg-002",
    runId: "run-v6-002",
    startedAt: "2026-05-16T11:00:00Z",
    finishedAt: "2026-05-16T11:01:00Z",
    durationMs: 45000,
    inputCounts: { evidence: 2, chronicle: 1, memoryEntries: 4 },
    fallbackReason: "timeout",
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb, livedExperienceAuditStore: store });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("status:v6")!;
  const result = (await cmd.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;

  // Narrative section: active with real data
  const narrative = data.narrative as Record<string, unknown>;
  assert.equal(narrative.status, "active");
  assert.equal(narrative.focus, "Wave 32 completion");
  assert.equal(narrative.groundingStatus, "pass"); // confidence 0.8 + active
  assert.equal(narrative.nextIntent, "Run tests");
  assert.equal(narrative.sourceRefCount, 2);

  // Dream section: has_runs
  const dream = data.dream as Record<string, unknown>;
  assert.equal(dream.status, "has_runs");
  assert.equal(dream.totalRuns, 2);
  assert.ok((dream.recentRunCount as number) > 0);
  assert.equal(dream.lastFallbackReason, "timeout");

  // Cycle section: has_cycles (dream.trace events contribute to dimension)
  const cycles = data.cycles as Record<string, unknown>;
  assert.equal(cycles.status, "has_cycles");
  assert.ok((cycles.totalCycles as number) > 0);
  const dimensions = cycles.dimensions as string[];
  assert.ok(dimensions.includes("dream"), "dream dimension must be present");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.6-C: status:v6 returns nothing_yet for missing sections without faking data", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  // Only seed dream events — no narrative, no cycle events of other types
  recorder.recordDreamTrace({
    traceId: "dream:partial-001",
    runId: "run-partial-001",
    startedAt: "2026-05-16T09:00:00Z",
    finishedAt: "2026-05-16T09:01:00Z",
    durationMs: 30000,
    inputCounts: { evidence: 1, chronicle: 0, memoryEntries: 2 },
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb, livedExperienceAuditStore: store });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("status:v6")!;
  const result = (await cmd.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;

  // No narrative in DB => nothing_yet
  const narrative = data.narrative as Record<string, unknown>;
  assert.equal(narrative.status, "nothing_yet", "no narrative in DB => nothing_yet");

  // Dream events exist => has_runs
  const dream = data.dream as Record<string, unknown>;
  assert.equal(dream.status, "has_runs");
  assert.equal(dream.totalRuns, 1);
  assert.equal(dream.lastFallbackReason, undefined);

  // Cycle dimension: only dream present
  const cycles = data.cycles as Record<string, unknown>;
  assert.equal(cycles.status, "has_cycles");
  const dimensions = cycles.dimensions as string[];
  assert.ok(dimensions.includes("dream"));
  assert.ok(!dimensions.includes("decision"), "no decision events => not in dimensions");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.6-D: status:v6 command is registered in createCommandRouter", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });

  const cmd = router.resolve("status:v6");
  assert.ok(cmd, "status:v6 must be registered in command router");
  assert.ok(cmd!.description.toLowerCase().includes("v6") || cmd!.description.toLowerCase().includes("aggregate"), "description must mention v6 or aggregate");

  await closeCliRuntimeDeps(deps);
});
