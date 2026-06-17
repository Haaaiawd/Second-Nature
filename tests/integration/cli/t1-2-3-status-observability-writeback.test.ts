/**
 * T1.2.3 — `loadStatus` aggregate observability writeback.
 *
 * Verifies that a workspace `heartbeat_check` (full runtime) writes:
 *   - `decision_ledger` row with `traceId` prefix `sn-runtime-`
 *   - `execution_attempts` row with `platformId === "second-nature-runtime"`
 * so that `loadStatus()` no longer returns `unknown` for `rhythm.mode` /
 * `runtime.serviceStatus` purely because observability tables are empty.
 *
 * Also verifies that carrier-only / probe-only paths intentionally do NOT write,
 * preserving the host-safe carrier contract from T1.1.3 / ADR-005.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { desc } from "drizzle-orm";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { decisionLedger, executionAttempts } from "../../../src/observability/db/schema/index.js";

test("T1.2.3 workspace heartbeat_check writes sn-runtime ledger + second-nature-runtime attempt", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });

  const before = await deps.readModels.loadStatus();
  assert.equal(before.rhythm.mode, "unknown", "baseline rhythm must be unknown when ledger is empty");
  assert.equal(
    before.runtime.serviceStatus,
    "unknown",
    "baseline runtime serviceStatus must be unknown when execution_attempts is empty",
  );

  const router = createCommandRouter({ deps });
  const cmd = router.resolve("heartbeat_check");
  assert.ok(cmd, "heartbeat_check command must be registered");

  const out = (await cmd!.execute({ timestamp: new Date().toISOString() })) as {
    ok: boolean;
    surfaceMode: string;
    livedExperienceLoopClaimed: boolean;
  };
  assert.equal(out.ok, true);
  assert.equal(out.surfaceMode, "workspace_full_runtime");
  assert.equal(out.livedExperienceLoopClaimed, true);

  const decisions = await observabilityDb.db
    .select()
    .from(decisionLedger)
    .orderBy(desc(decisionLedger.createdAt))
    .limit(5);
  const runtimeDecision = decisions.find((row) => row.traceId.startsWith("sn-runtime-"));
  assert.ok(runtimeDecision, "decision_ledger must contain a sn-runtime-* row after heartbeat_check");

  const attempts = await observabilityDb.db
    .select()
    .from(executionAttempts)
    .orderBy(desc(executionAttempts.startedAt));
  const runtimeAttempt = attempts.find((row) => row.platformId === "second-nature-runtime");
  assert.ok(
    runtimeAttempt,
    "execution_attempts must contain a second-nature-runtime row after heartbeat_check",
  );
  assert.equal(runtimeAttempt!.traceId, runtimeDecision!.traceId, "attempt and decision must share traceId");

  const after = await deps.readModels.loadStatus();
  assert.notEqual(after.rhythm.mode, "unknown", "rhythm.mode must exit unknown after a recorded cycle");
  assert.notEqual(
    after.runtime.serviceStatus,
    "unknown",
    "runtime.serviceStatus must exit unknown after a recorded attempt",
  );

  closeCliRuntimeDeps(deps);
});

test("T1.2.3 probeOnly heartbeat_check does not write observability rows (host-safe carrier preserved)", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });

  const router = createCommandRouter({ deps });
  const cmd = router.resolve("heartbeat_check");
  assert.ok(cmd);

  const out = (await cmd!.execute({ probeOnly: true })) as {
    ok: boolean;
    surfaceMode: string;
  };
  assert.equal(out.ok, true);
  assert.equal(out.surfaceMode, "capability_probe");

  const decisions = await observabilityDb.db.select().from(decisionLedger);
  const attempts = await observabilityDb.db.select().from(executionAttempts);
  assert.equal(
    decisions.filter((d) => d.traceId.startsWith("sn-runtime-")).length,
    0,
    "probe-only must not write sn-runtime decision rows",
  );
  assert.equal(
    attempts.filter((a) => a.platformId === "second-nature-runtime").length,
    0,
    "probe-only must not write second-nature-runtime attempts",
  );

  const after = await deps.readModels.loadStatus();
  assert.equal(after.rhythm.mode, "unknown", "probe-only must keep rhythm.mode unknown");
  assert.equal(after.runtime.serviceStatus, "unknown", "probe-only must keep runtime.serviceStatus unknown");

  closeCliRuntimeDeps(deps);
});
