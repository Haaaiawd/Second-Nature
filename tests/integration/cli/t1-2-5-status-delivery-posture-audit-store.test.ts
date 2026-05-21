/**
 * T1.2.5 — `status` 投递姿态 + 默认 `livedExperienceAuditStore` 接线。
 *
 * CH-14-04 根因：`status` 缺 `deliveryPosture` → operator 无法区分 workspace 默认 `none`
 *   vs OpenClaw cron `delivery.mode: none`。
 * CH-14-05 根因：`createCliReadModels` 未默认注入 `livedExperienceAuditStore`，
 *   导致 `explain(fallback:…)` 恒返回 `lived_experience_audit_store_unavailable` 骨架。
 *
 * 验收标准：
 * A. `loadStatus()` 返回 `deliveryPosture` 字段，`source === "workspace_default_none"` 时与
 *    workspace 心跳硬编码 `target:none` 一致。
 * B. 默认 `createCliReadModels` 不注入 auditStore 时，`explain(fallback:…)` 返回
 *    `no_matching_audit_events` 而非 `lived_experience_audit_store_unavailable`。
 * C. 显式注入 auditStore 时仍正常工作。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  createCliReadModels,
  type CliReadModels,
} from "../../../src/cli/read-models/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import type { DeliveryPosture } from "../../../src/cli/read-models/types.js";

// ─── Case A: loadStatus includes deliveryPosture with workspace_default_none ──

test("T1.2.5 A — loadStatus returns deliveryPosture.source === workspace_default_none", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const status = await readModels.loadStatus();

  assert.ok(
    status.deliveryPosture !== undefined,
    "loadStatus must return deliveryPosture field (T1.2.5 / CH-14-04)",
  );
  const posture = status.deliveryPosture as DeliveryPosture;
  assert.equal(
    posture.source,
    "workspace_default_none",
    "deliveryPosture.source must be workspace_default_none (workspace heartbeat hardcodes target:none)",
  );
  assert.equal(posture.verdict, "none", "deliveryPosture.verdict must be none for default workspace");
  assert.ok(
    typeof posture.reasonCode === "string" && posture.reasonCode.length > 0,
    "deliveryPosture.reasonCode must be a non-empty string",
  );

  stateDb.close();
  observabilityDb.close();
});

// ─── Case B: explain(fallback:…) without explicit auditStore → no_matching_audit_events ──

test("T1.2.5 B — explain(fallback:…) without explicit auditStore returns no_matching_audit_events", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  // Default: no explicit livedExperienceAuditStore provided.
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const result = await readModels.explain({ kind: "fallback", id: "fallback:nonexistent-test" });

  // Must NOT return the skeleton "unavailable" error — should return "no_matching_audit_events"
  // since the store is now default-injected (empty) rather than undefined.
  assert.notEqual(
    result.conclusion,
    "lived_experience_audit_store_unavailable",
    "explain(fallback:…) must not return lived_experience_audit_store_unavailable with default deps",
  );
  assert.equal(
    result.conclusion,
    "no_matching_audit_events",
    "explain(fallback:…) must return no_matching_audit_events when store is empty but available",
  );

  stateDb.close();
  observabilityDb.close();
});

// ─── Case C: explain(delivery:…) with empty default store → no_matching_audit_events ──

test("T1.2.5 C — explain(delivery:…) with default deps returns no_matching_audit_events", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const result = await readModels.explain({ kind: "delivery", id: "audit:delivery-test" });

  assert.notEqual(
    result.conclusion,
    "lived_experience_audit_store_unavailable",
    "explain(delivery:…) must not return unavailable with default deps",
  );
  // With an empty default store, result should be no_matching_audit_events.
  assert.equal(result.conclusion, "no_matching_audit_events");

  stateDb.close();
  observabilityDb.close();
});

// ─── Case D: explicit livedExperienceAuditStore still works ───────────────────

test("T1.2.5 D — explicit livedExperienceAuditStore injection still works", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const explicitStore = new AppendOnlyAuditStore();

  const readModels: CliReadModels = createCliReadModels({
    stateDb,
    observabilityDb,
    livedExperienceAuditStore: explicitStore,
  });

  // With explicit empty store, should still return no_matching_audit_events.
  const result = await readModels.explain({ kind: "fallback", id: "fallback:test-d" });
  assert.equal(result.conclusion, "no_matching_audit_events");

  stateDb.close();
  observabilityDb.close();
});

// ─── Case E: loadStatus deliveryPosture JSON shape is stable ──────────────────

test("T1.2.5 E — deliveryPosture JSON shape is stable and machine-readable", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  const status = await readModels.loadStatus();
  const posture = status.deliveryPosture;
  assert.ok(posture, "deliveryPosture must be present");

  // All fields must be strings (machine-readable).
  assert.equal(typeof posture.verdict, "string");
  assert.equal(typeof posture.source, "string");
  assert.equal(typeof posture.reasonCode, "string");

  // Verify source is one of the known values.
  const validSources = ["workspace_default_none", "openclaw_cron_delivery_none", "host_capability_probe"];
  assert.ok(
    validSources.includes(posture.source),
    `deliveryPosture.source must be one of ${validSources.join(", ")}, got ${posture.source}`,
  );

  stateDb.close();
  observabilityDb.close();
});
