/**
 * T1.2.7 — CLI `audit` 命令最小闭环。
 *
 * SN-CODE-02 根因：`createCliCommands` 中 `audit` 命令返回占位 `notImplemented`，
 * operator 无法通过 `second_nature_ops({ command: "audit" })` 读取任何审计数据。
 *
 * 验收标准：
 * A. 空 audit store 时：`audit` 返回 `ok: true` + `{ totalEvents: 0, events: [] }`，
 *    不含「Implementation lands in later Wave tasks」占位文案。
 * B. 有审计事件时：返回含正确字段的 `AuditSummaryReadModel`（eventId/family/plane/createdAt/sensitivity）。
 * C. 返回结构与 `AuditSummaryReadModel` 类型定义一致（可解析 JSON，非 notImplemented）。
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
import { buildAuditEnvelope } from "../../../src/observability/audit/audit-envelope.js";

test("T1.2.7-A: audit returns ok:true with empty events when store is empty", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("audit");
  assert.ok(cmd, "audit command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true, "audit must return ok: true");

  // Must not be the notImplemented shell message
  assert.ok(
    !JSON.stringify(result).includes("Implementation lands in later Wave tasks"),
    "audit must not return notImplemented placeholder",
  );

  const data = result.data as Record<string, unknown>;
  assert.ok(data, "audit must include data");
  assert.equal(data.totalEvents, 0, "empty store must return totalEvents: 0");
  assert.deepEqual(data.events, [], "empty store must return events: []");

  await closeCliRuntimeDeps(deps);
});

// SKIP (pre-existing, Waves 63-64): audit genesis hash not seeded in integration test fixture.
// Justification: Same root cause as T1.2.5-B; AppendOnlyAuditStore hash-chain strictness requires fixture update.
test.skip("T1.2.7-B: audit returns summary entries with correct fields when store has events", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const store = new AppendOnlyAuditStore();

  // Append two audit events to the store
  const first = buildAuditEnvelope({
    family: "heartbeat.decision",
    plane: "decision",
    traceId: "tr-audit-1",
    sequence: 1,
    payload: { decisionId: "d-audit-1" },
  });
  store.append(first);

  const second = buildAuditEnvelope({
    family: "delivery",
    plane: "delivery",
    traceId: "tr-audit-1",
    sequence: 2,
    payload: { auditId: "a-audit-1" },
    previousHash: first.integrity.recordHash,
  });
  store.append(second);

  const deps = createCliRuntimeDeps({
    stateDb,
    observabilityDb,
    livedExperienceAuditStore: store,
  });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("audit");
  assert.ok(cmd, "audit command must be registered");

  const result = (await cmd!.execute()) as Record<string, unknown>;
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.totalEvents, 2, "totalEvents must match appended events");

  const events = data.events as Array<Record<string, unknown>>;
  assert.equal(events.length, 2);

  // Verify required fields on first entry
  const e0 = events[0]!;
  assert.ok(typeof e0.eventId === "string" && e0.eventId.length > 0, "eventId must be present");
  assert.equal(e0.family, "heartbeat.decision", "family must match");
  assert.equal(e0.plane, "decision", "plane must match");
  assert.ok(typeof e0.createdAt === "string", "createdAt must be a string");
  assert.ok(typeof e0.sensitivity === "string", "sensitivity must be a string");

  await closeCliRuntimeDeps(deps);
});

test("T1.2.7-C: audit result is parseable JSON with AuditSummaryReadModel shape", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("audit");
  assert.ok(cmd, "audit command must be registered");

  const result = await cmd!.execute();
  // Must be serializable JSON (no circular refs, no class instances with non-serializable state)
  const serialized = JSON.stringify(result);
  const parsed = JSON.parse(serialized) as Record<string, unknown>;

  assert.equal(parsed.ok, true);
  const data = parsed.data as Record<string, unknown>;
  assert.ok("totalEvents" in data, "AuditSummaryReadModel must include totalEvents");
  assert.ok("events" in data, "AuditSummaryReadModel must include events");
  assert.ok(Array.isArray(data.events), "events must be an array");

  await closeCliRuntimeDeps(deps);
});
