/**
 * Unit coverage for `createRuntimeDecisionRecorder` (T1.2.3).
 *
 * Verifies trace prefix, platformId, mode default, and failure mapping for the
 * observability writeback path that powers `loadStatus` aggregation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { desc, eq } from "drizzle-orm";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import {
  createRuntimeDecisionRecorder,
  RUNTIME_DECISION_TRACE_PREFIX,
  RUNTIME_INTERNAL_PLATFORM_ID,
} from "../../../src/observability/services/runtime-decision-recorder.js";
import { decisionLedger, executionAttempts } from "../../../src/observability/db/schema/index.js";
import type { HeartbeatCycleResult, HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";

function makeSignal(timestamp = "2026-05-09T10:00:00.000Z"): HeartbeatSignal {
  return {
    trigger: "heartbeat_bridge",
    payload: { timestamp },
  };
}

test("T1.2.3 recorder writes sn-runtime trace + second-nature-runtime attempt with succeeded status", async () => {
  const db = createObservabilityDatabase(":memory:");
  const recorder = createRuntimeDecisionRecorder(db);

  const cycle: HeartbeatCycleResult = {
    scope: "rhythm",
    status: "heartbeat_ok",
    reasons: ["silent_no_candidates"],
  };
  const out = await recorder.recordHeartbeatCycle({ cycle, signal: makeSignal() });
  assert.ok(out.traceId.startsWith(RUNTIME_DECISION_TRACE_PREFIX));

  const ledgerRow = (
    await db.db.select().from(decisionLedger).where(eq(decisionLedger.traceId, out.traceId)).limit(1)
  )[0];
  assert.ok(ledgerRow, "ledger row must exist");
  assert.equal(ledgerRow.mode, "active", "default mode must be active so loadStatus exits unknown for rhythm");

  const attemptRow = (
    await db.db.select().from(executionAttempts).where(eq(executionAttempts.traceId, out.traceId)).limit(1)
  )[0];
  assert.ok(attemptRow, "execution_attempts row must exist");
  assert.equal(attemptRow.platformId, RUNTIME_INTERNAL_PLATFORM_ID);
  assert.equal(attemptRow.status, "succeeded", "non-failure cycle must produce succeeded attempt");
  assert.equal(attemptRow.failureClass, null);
});

test("T1.2.3 recorder marks delivery_unavailable cycles as failed with delivery_unavailable failureClass", async () => {
  const db = createObservabilityDatabase(":memory:");
  const recorder = createRuntimeDecisionRecorder(db);

  const cycle: HeartbeatCycleResult = {
    scope: "rhythm",
    status: "delivery_unavailable",
    reasons: ["delivery_target_none"],
  };
  const out = await recorder.recordHeartbeatCycle({ cycle, signal: makeSignal() });

  const attemptRow = (
    await db.db.select().from(executionAttempts).where(eq(executionAttempts.traceId, out.traceId)).limit(1)
  )[0];
  assert.equal(attemptRow.status, "failed");
  assert.equal(attemptRow.failureClass, "delivery_unavailable");
});

test("T1.2.3 recorder respects rhythmMode override (Quiet semantics propagate to status.quiet)", async () => {
  const db = createObservabilityDatabase(":memory:");
  const recorder = createRuntimeDecisionRecorder(db);

  const cycle: HeartbeatCycleResult = {
    scope: "rhythm",
    status: "heartbeat_ok",
    reasons: ["quiet_window"],
  };
  await recorder.recordHeartbeatCycle({
    cycle,
    signal: makeSignal(),
    rhythmMode: "quiet",
  });

  const latest = (
    await db.db.select().from(decisionLedger).orderBy(desc(decisionLedger.createdAt)).limit(1)
  )[0];
  assert.equal(latest.mode, "quiet");
});
