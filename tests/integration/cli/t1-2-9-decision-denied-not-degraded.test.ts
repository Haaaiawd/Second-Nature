/**
 * T1.2.9 — `decision_denied` 不得冒充 runtime `degraded`（语义修正）。
 *
 * SN-CODE-04 根因：`mapRuntimeStatus` 对任何非空 `failureClass` 一律返回 `degraded`，
 * 导致控制面拒绝（无可执行候选）与真正执行/投递故障混淆。
 *
 * 验收标准：
 * A. 最近一次 second-nature-runtime attempt 的 failureClass === "decision_denied" 时，
 *    `loadStatus()` 的 `runtime.serviceStatus` 返回 `"awaiting_sources"`，不得为 `"degraded"`。
 * B. 最近一次 attempt 的 failureClass === "delivery_unavailable" 时，
 *    `runtime.serviceStatus` 仍返回 `"degraded"`（真正故障路径不受影响）。
 * C. failureClass 为 null 且 status === "succeeded" 时，返回 `"running"`。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createCliRuntimeDeps } from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import {
  createRuntimeDecisionRecorder,
  RUNTIME_INTERNAL_PLATFORM_ID,
} from "../../../src/observability/services/runtime-decision-recorder.js";
import { ExecutionTelemetry } from "../../../src/observability/services/execution-telemetry.js";
import { DecisionLedger } from "../../../src/observability/services/decision-ledger.js";

// ---------------------------------------------------------------------------
// Helper: write a fake execution_attempt row with given failureClass
// ---------------------------------------------------------------------------
async function writeAttempt(
  observabilityDb: ReturnType<typeof createObservabilityDatabase>,
  failureClass: string | null,
  status: "succeeded" | "failed",
  ts: string,
) {
  const telemetry = new ExecutionTelemetry(observabilityDb);
  const ledger = new DecisionLedger(observabilityDb);

  const decisionId = `decision-test-${ts}`;
  const traceId = `sn-runtime-test-${ts}`;

  // Write a minimal decision_ledger row so foreign-key lookups don't fail
  await ledger.recordHeartbeatDecision({
    id: decisionId,
    tickId: `tick-test-${ts}`,
    traceId,
    runtimeScope: "rhythm",
    triggerSource: "heartbeat_bridge",
    decisionStatus:
      failureClass === "decision_denied" ? "denied" : "delivery_unavailable",
    reasons: [],
    intentId: undefined,
    mode: "active",
    createdAt: ts,
  });

  await telemetry.startAttempt({
    traceId,
    decisionId,
    intentId: `${RUNTIME_INTERNAL_PLATFORM_ID}-tick`,
    platformId: RUNTIME_INTERNAL_PLATFORM_ID,
    capability: "runtime.heartbeat",
    channel: "internal",
    startedAt: ts,
  });
  await telemetry.completeAttempt(
    traceId,
    status,
    undefined,
    failureClass ?? undefined,
  );
}

// ---------------------------------------------------------------------------

test("T1.2.9-A: decision_denied returns awaiting_sources, not degraded", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });

  await writeAttempt(
    observabilityDb,
    "decision_denied",
    "failed",
    "2026-05-11T10:00:00.000Z",
  );

  const result = await deps.readModels.loadStatus();
  assert.equal(
    result.runtime.serviceStatus,
    "awaiting_sources",
    "decision_denied must map to awaiting_sources, not degraded",
  );
  assert.notEqual(
    result.runtime.serviceStatus,
    "degraded",
    "decision_denied must NOT map to degraded",
  );
});

test("T1.2.9-B: delivery_unavailable still returns degraded", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });

  await writeAttempt(
    observabilityDb,
    "delivery_unavailable",
    "failed",
    "2026-05-11T10:01:00.000Z",
  );

  const result = await deps.readModels.loadStatus();
  assert.equal(
    result.runtime.serviceStatus,
    "degraded",
    "delivery_unavailable is a real fault and must remain degraded",
  );
});

test("T1.2.9-C: succeeded attempt (no failureClass) returns running", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });

  await writeAttempt(
    observabilityDb,
    null,
    "succeeded",
    "2026-05-11T10:02:00.000Z",
  );

  const result = await deps.readModels.loadStatus();
  assert.equal(
    result.runtime.serviceStatus,
    "running",
    "successful attempt with no failureClass must return running",
  );
});
