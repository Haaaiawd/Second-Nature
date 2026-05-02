import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createGovernancePlaneRecorder } from "../../../src/observability/services/governance-plane-recorder.js";
import { executionAttempts, governanceAudit } from "../../../src/observability/db/schema/index.js";

test("T5.1.2 recordConnectorAttempt writes execution telemetry (failed governance)", async () => {
  const db = createObservabilityDatabase(":memory:");
  const plane = createGovernancePlaneRecorder(db);

  const ack = await plane.recordConnectorAttempt({
    traceId: "trace-gov-1",
    decisionId: "dec-1",
    intentId: "intent-1",
    platformId: "moltbook",
    capability: "feed.read",
    channel: "read_only",
    outcome: "failed",
    failureClass: "rate_limited",
  });

  assert.ok(ack.recordId.startsWith("ca-trace-gov-1"));
  const rows = await db.db.select().from(executionAttempts).where(eq(executionAttempts.traceId, "trace-gov-1"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "failed");
  assert.equal(rows[0]?.failureClass, "rate_limited");
  db.close();
});

test("T5.1.2 recordConnectorAttempt sampled telemetry success", async () => {
  const db = createObservabilityDatabase(":memory:");
  const plane = createGovernancePlaneRecorder(db);

  await plane.recordConnectorAttempt({
    traceId: "trace-gov-2",
    decisionId: "dec-2",
    intentId: "intent-2",
    platformId: "moltbook",
    capability: "feed.read",
    channel: "read_only",
    outcome: "sampled_telemetry",
  });

  const rows = await db.db.select().from(executionAttempts).where(eq(executionAttempts.traceId, "trace-gov-2"));
  assert.equal(rows[0]?.status, "succeeded");
  db.close();
});

test("T5.1.2 recordStateGovernance fallback_written is queryable by traceId", async () => {
  const db = createObservabilityDatabase(":memory:");
  const plane = createGovernancePlaneRecorder(db);

  await plane.recordStateGovernance({
    id: "gov-fb-1",
    traceId: "trace-fb-1",
    kind: "fallback_written",
    reason: "target_none",
    decisionId: "dec-fb",
    supportingSources: ["ref:a"],
  });

  const rows = await db.db.select().from(governanceAudit).where(eq(governanceAudit.targetAssetId, "trace-fb-1"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.eventType, "fallback_written");
  assert.ok(String(rows[0]?.reason).includes("dec-fb"));
  db.close();
});

test("T5.1.2 recordStateGovernance effect_commit_advanced", async () => {
  const db = createObservabilityDatabase(":memory:");
  const plane = createGovernancePlaneRecorder(db);

  await plane.recordStateGovernance({
    id: "gov-ec-1",
    traceId: "trace-ec-1",
    kind: "effect_commit_advanced",
    reason: "committed",
  });

  const rows = await db.db.select().from(governanceAudit).where(eq(governanceAudit.targetAssetId, "trace-ec-1"));
  assert.equal(rows[0]?.eventType, "effect_commit_advanced");
  db.close();
});
