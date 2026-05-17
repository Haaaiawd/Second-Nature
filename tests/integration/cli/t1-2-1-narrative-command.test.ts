/**
 * T1.2.1 — CLI `narrative` 命令最小闭环。
 *
 * Acceptance:
 * A. 无数据时返回 ok:true + status nothing_yet，不返回空对象。
 * B. 有数据时返回 focus、progress、nextIntent、sourceRefs、groundingStatus。
 * C. groundingStatus 随 confidence 正确推导（pass / degraded / blocked）。
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
import { createNarrativeStateStore } from "../../../src/storage/narrative/narrative-state-store.js";

test("T1.2.1-A: narrative returns ok:true with nothing_yet when store is empty", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("narrative");
  assert.ok(cmd, "narrative command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "narrative must return ok: true");
  assert.ok(
    !JSON.stringify(result).includes("Implementation lands in later Wave tasks"),
    "must not return notImplemented placeholder",
  );

  const data = result.data as Record<string, unknown>;
  assert.ok(data, "must include data");
  assert.equal(data.status, "nothing_yet", "empty store must return status: nothing_yet");
  assert.equal(data.focus, "", "empty store focus must be empty string");
  assert.deepEqual(data.progress, [], "empty store progress must be []");
  assert.deepEqual(data.sourceRefs, [], "empty store sourceRefs must be []");
  assert.equal(data.groundingStatus, "blocked", "empty store groundingStatus must be blocked");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.1-B: narrative returns full NarrativeReadModel shape when data exists", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");

  // Seed a NarrativeState row before constructing deps
  const narrativeStore = createNarrativeStateStore(stateDb);
  await narrativeStore.updateNarrativeState({
    narrativeId: "default",
    revision: 2,
    focus: "Completing Wave 32 narrative command",
    progress: ["T1.2.1 spec implemented", "T1.2.6 aggregate ready"],
    nextIntent: "Write integration tests",
    confidence: 0.85,
    sourceRefs: [{ sourceId: "src-001", kind: "heartbeat", url: "https://example.com/evidence" }],
    unsupportedClaims: [],
    status: "active",
    updatedAt: "2026-05-16T10:00:00Z",
  });

  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("narrative");
  assert.ok(cmd);

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  assert.equal(data.narrativeId, "default");
  assert.equal(data.revision, 2);
  assert.equal(data.focus, "Completing Wave 32 narrative command");
  assert.deepEqual(data.progress, ["T1.2.1 spec implemented", "T1.2.6 aggregate ready"]);
  assert.equal(data.nextIntent, "Write integration tests");
  assert.equal(data.confidence, 0.85);
  assert.equal(data.status, "active");
  assert.equal(data.updatedAt, "2026-05-16T10:00:00Z");

  const refs = data.sourceRefs as Array<Record<string, unknown>>;
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.sourceId, "src-001");
  assert.equal(refs[0]!.kind, "heartbeat");
  assert.equal(refs[0]!.url, "https://example.com/evidence");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.1-C: groundingStatus correctly derived from confidence and status", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const narrativeStore = createNarrativeStateStore(stateDb);

  // Case 1: confidence >= 0.7, active => pass
  await narrativeStore.updateNarrativeState({
    narrativeId: "default",
    revision: 1,
    focus: "pass scenario",
    progress: [],
    nextIntent: "next",
    confidence: 0.75,
    sourceRefs: [],
    unsupportedClaims: [],
    status: "active",
    updatedAt: "2026-05-16T10:00:00Z",
  });

  let deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  let router = createCommandRouter({ deps });
  let cmd = router.resolve("narrative")!;
  let result = (await cmd.execute()) as Record<string, unknown>;
  let data = result.data as Record<string, unknown>;
  assert.equal(data.groundingStatus, "pass", "confidence 0.75 + active => pass");
  await closeCliRuntimeDeps(deps);

  // Case 2: confidence 0.5, insufficient_sources => degraded
  const stateDb2 = createStateDatabase(":memory:");
  const narrativeStore2 = createNarrativeStateStore(stateDb2);
  await narrativeStore2.updateNarrativeState({
    narrativeId: "default",
    revision: 1,
    focus: "degraded scenario",
    progress: [],
    nextIntent: "next",
    confidence: 0.5,
    sourceRefs: [],
    unsupportedClaims: ["unsupported claim"],
    status: "insufficient_sources",
    updatedAt: "2026-05-16T10:00:00Z",
  });

  deps = createCliRuntimeDeps({ stateDb: stateDb2, observabilityDb });
  router = createCommandRouter({ deps });
  cmd = router.resolve("narrative")!;
  result = (await cmd.execute()) as Record<string, unknown>;
  data = result.data as Record<string, unknown>;
  assert.equal(data.groundingStatus, "degraded", "confidence 0.5 + insufficient_sources => degraded");
  await closeCliRuntimeDeps(deps);

  // Case 3: awaiting_sources => blocked
  const stateDb3 = createStateDatabase(":memory:");
  const narrativeStore3 = createNarrativeStateStore(stateDb3);
  await narrativeStore3.updateNarrativeState({
    narrativeId: "default",
    revision: 1,
    focus: "blocked scenario",
    progress: [],
    nextIntent: "next",
    confidence: 0.9,
    sourceRefs: [],
    unsupportedClaims: [],
    status: "awaiting_sources",
    updatedAt: "2026-05-16T10:00:00Z",
  });

  const obsDb3 = createObservabilityDatabase(":memory:");
  deps = createCliRuntimeDeps({ stateDb: stateDb3, observabilityDb: obsDb3 });
  router = createCommandRouter({ deps });
  cmd = router.resolve("narrative")!;
  result = (await cmd.execute()) as Record<string, unknown>;
  data = result.data as Record<string, unknown>;
  assert.equal(data.groundingStatus, "blocked", "awaiting_sources => blocked regardless of confidence");
  await closeCliRuntimeDeps(deps);
});

test("T1.2.1-D: narrative command is registered in createCommandRouter", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });

  const cmd = router.resolve("narrative");
  assert.ok(cmd, "narrative must be registered in command router");
  assert.ok(cmd!.description.toLowerCase().includes("narrative"), "description must mention narrative");

  await closeCliRuntimeDeps(deps);
});
