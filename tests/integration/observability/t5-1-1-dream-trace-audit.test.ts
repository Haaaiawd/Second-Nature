/**
 * T5.1.1 — DreamTrace audit envelope emitted by LivedExperienceAuditRecorder.
 *
 * Acceptance:
 * A. recordDreamTrace writes a dream.trace family envelope into the audit store.
 * B. Envelope contains correct traceId, runId, durationMs, inputCounts, fallbackReason.
 * C. No fallbackReason → lifecycleStatus inferred as "completed" by read model.
 * D. With fallbackReason → lifecycleStatus inferred as "partial" by read model.
 * E. Empty store returns honest empty (totalRuns: 0, runs: []) via loadDreamRecent.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";
import { createCliReadModels } from "../../../src/cli/read-models/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

test("T5.1.1-A: recordDreamTrace writes dream.trace envelope into audit store", async () => {
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  const trace = {
    traceId: "dream:trace-001",
    runId: "run-001",
    startedAt: "2026-05-16T08:00:00Z",
    finishedAt: "2026-05-16T08:01:30Z",
    durationMs: 90000,
    inputCounts: { evidence: 3, chronicle: 2, memoryEntries: 5 },
  };

  const result = recorder.recordDreamTrace(trace);
  assert.ok(result.eventId, "eventId must be present");

  const events = store.list();
  assert.equal(events.length, 1);
  assert.equal(events[0]!.family, "dream.trace");
  assert.equal(events[0]!.plane, "telemetry");
  assert.equal(events[0]!.traceId, "dream:trace-001");
});

test("T5.1.1-B: loadDreamRecent returns correct fields for completed run", async () => {
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  recorder.recordDreamTrace({
    traceId: "dream:trace-002",
    runId: "run-002",
    startedAt: "2026-05-16T08:00:00Z",
    finishedAt: "2026-05-16T08:01:00Z",
    durationMs: 60000,
    inputCounts: { evidence: 2, chronicle: 1, memoryEntries: 3 },
  });

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb, livedExperienceAuditStore: store });

  const recent = await readModels.loadDreamRecent(5);
  assert.equal(recent.totalRuns, 1);
  assert.equal(recent.runs.length, 1);

  const run = recent.runs[0]!;
  assert.equal(run.traceId, "dream:trace-002");
  assert.equal(run.runId, "run-002");
  assert.equal(run.durationMs, 60000);
  assert.deepEqual(run.inputCounts, { evidence: 2, chronicle: 1, memoryEntries: 3 });
  assert.equal(run.lifecycleStatus, "completed");
  assert.equal(run.fallbackReason, undefined);
  assert.equal(run.insightsCount, 0);
  assert.ok(typeof run.createdAt === "string");
});

test("T5.1.1-C: loadDreamRecent infers partial status when fallbackReason present", async () => {
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  recorder.recordDreamTrace({
    traceId: "dream:trace-003",
    runId: "run-003",
    startedAt: "2026-05-16T08:00:00Z",
    finishedAt: "2026-05-16T08:00:10Z",
    durationMs: 10000,
    inputCounts: { evidence: 1, chronicle: 0, memoryEntries: 1 },
    fallbackReason: "validation_failed_schema",
  });

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb, livedExperienceAuditStore: store });

  const recent = await readModels.loadDreamRecent(5);
  assert.equal(recent.runs[0]!.lifecycleStatus, "partial");
  assert.equal(recent.runs[0]!.fallbackReason, "validation_failed_schema");
});

test("T5.1.1-D: loadDreamRecent respects limit and sorts descending by createdAt", async () => {
  const store = new AppendOnlyAuditStore();
  const recorder = createLivedExperienceAuditRecorder(store);

  for (let i = 0; i < 5; i++) {
    recorder.recordDreamTrace({
      traceId: `dream:trace-${i}`,
      runId: `run-${i}`,
      startedAt: "2026-05-16T08:00:00Z",
      finishedAt: `2026-05-16T0${i}:00:00Z`,
      durationMs: 1000,
      inputCounts: { evidence: 1, chronicle: 0, memoryEntries: 0 },
    });
  }

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb, livedExperienceAuditStore: store });

  const recent = await readModels.loadDreamRecent(2);
  assert.equal(recent.totalRuns, 5);
  assert.equal(recent.runs.length, 2);
  // Descending order: run-4 (04:00) should come first
  assert.equal(recent.runs[0]!.runId, "run-4");
  assert.equal(recent.runs[1]!.runId, "run-3");
});

test("T5.1.1-E: loadDreamRecent returns honest empty when store has no dream traces", async () => {
  const store = new AppendOnlyAuditStore();
  // No dream traces inserted
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb, livedExperienceAuditStore: store });

  const recent = await readModels.loadDreamRecent(5);
  assert.equal(recent.totalRuns, 0);
  assert.deepEqual(recent.runs, []);
});
