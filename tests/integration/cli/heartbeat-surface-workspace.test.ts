import test from "node:test";
import assert from "node:assert/strict";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
  heartbeatCheck,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

test("T1.1.3 heartbeatCheck runtime unavailable returns runtime_carrier_only without lived-experience claim", async () => {
  const r = await heartbeatCheck({ runtimeAvailable: false });
  assert.equal(r.status, "runtime_carrier_only");
  assert.equal(r.surfaceMode, "host_safe_carrier");
  assert.equal(r.livedExperienceLoopClaimed, false);
});

test("T1.1.3 heartbeatCheck without readModels must not claim heartbeat_ok (CH-09-02)", async () => {
  const r = await heartbeatCheck({ runtimeAvailable: true, readModels: undefined });
  assert.equal(r.status, "runtime_carrier_only");
  assert.equal(r.surfaceMode, "host_safe_carrier");
  assert.ok(r.reasons.includes("heartbeat_read_models_unavailable"));
  assert.equal(r.livedExperienceLoopClaimed, false);
});

test("T1.1.3 heartbeatCheck fake control-plane passthrough is schema parity only", async () => {
  const r = await heartbeatCheck({
    runtimeAvailable: true,
    fakeControlPlanePassthrough: { decisionId: "dec-fake" },
  });
  assert.equal(r.status, "intent_selected");
  assert.equal(r.schemaParityOnly, true);
  assert.equal(r.livedExperienceLoopClaimed, false);
  assert.equal(r.decisionId, "dec-fake");
});

test("T1.1.3 command router exposes heartbeat_check with stable fields", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("heartbeat_check");
  assert.ok(cmd);
  const out = (await cmd!.execute({ probeOnly: true })) as unknown as {
    ok: boolean;
    status: string;
    surfaceMode: string;
    livedExperienceLoopClaimed: boolean;
  };
  assert.equal(out.ok, true);
  assert.equal(out.status, "heartbeat_ok");
  assert.equal(out.surfaceMode, "capability_probe");
  assert.equal(out.livedExperienceLoopClaimed, false);
  closeCliRuntimeDeps(deps);
});

test("T1.1.3 heartbeat_check with read models does not return legacy placeholder reasons", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("heartbeat_check");
  assert.ok(cmd);
  const out = (await cmd!.execute({ timestamp: "2026-05-03T10:00:00.000Z" })) as { ok: boolean; reasons: string[]; surfaceMode: string };
  assert.equal(out.ok, true);
  assert.equal(out.surfaceMode, "workspace_full_runtime");
  assert.ok(!out.reasons.includes("s1_placeholder_no_decision_loop"));
  assert.ok(!out.reasons.includes("heartbeat_read_models_unavailable"));
  closeCliRuntimeDeps(deps);
});
