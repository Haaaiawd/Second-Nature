import test from "node:test";
import assert from "node:assert/strict";

import {
  scheduleDream,
  shouldTrigger,
  memoryLockPort,
  type SchedulerInput,
  type DreamStatePort,
  type TriggerPolicy,
} from "../../../src/dream/index.js";

test("T7.1.2 manual trigger starts Dream async and returns started", async () => {
  const statePort: DreamStatePort = {
    async loadDreamInputs() {
      return {
        evidenceRefs: ["ev-1"],
        chronicleEntryIds: ["ch-1"],
        inputCounts: { evidence: 1, chronicle: 1, memoryEntries: 0 },
        goalSnapshotIds: [],
      };
    },
    async writeDreamOutput(output) {
      return { outputId: output.outputId, status: "acknowledged" };
    },
    async markDreamOutputLifecycle() {
      return { outputId: "out-1", status: "acknowledged" };
    },
  };

  const result = await scheduleDream({
    runId: "run-sched-001",
    traceId: "trace-sched-001",
    triggerKind: "manual",
    statePort,
  });

  assert.equal(result.status, "started");
  assert.equal(result.runId, "run-sched-001");
});

test("T7.1.2 concurrent run on same window is skipped due to lock", async () => {
  const lockPort = memoryLockPort();
  const statePort: DreamStatePort = {
    async loadDreamInputs() {
      return {
        evidenceRefs: ["ev-1"],
        chronicleEntryIds: ["ch-1"],
        inputCounts: { evidence: 1, chronicle: 1, memoryEntries: 0 },
        goalSnapshotIds: [],
      };
    },
    async writeDreamOutput(output) {
      return { outputId: output.outputId, status: "acknowledged" };
    },
    async markDreamOutputLifecycle() {
      return { outputId: "out-1", status: "acknowledged" };
    },
  };

  // First schedule acquires lock
  const first = await scheduleDream({
    runId: "run-sched-002",
    traceId: "trace-sched-002",
    triggerKind: "manual",
    statePort,
    lockPort,
  });
  assert.equal(first.status, "started");

  // Second schedule should be skipped
  const second = await scheduleDream({
    runId: "run-sched-003",
    traceId: "trace-sched-003",
    triggerKind: "manual",
    statePort,
    lockPort,
  });
  assert.equal(second.status, "skipped");
  assert.ok(second.reason?.includes("lock_held_by"));
});

test("T7.1.2 cron policy triggers when due", () => {
  const policy: TriggerPolicy = {
    type: "cron",
    intervalHours: 24,
    lastRunAt: "2026-05-14T10:00:00Z",
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "cron_due");
});

test("T7.1.2 cron policy does not trigger before due", () => {
  const policy: TriggerPolicy = {
    type: "cron",
    intervalHours: 24,
    lastRunAt: new Date().toISOString(),
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, false);
  assert.ok(result.reason?.includes("next_run_at"));
});

test("T7.1.2 evidence threshold policy triggers when threshold reached", () => {
  const policy: TriggerPolicy = {
    type: "evidence_threshold",
    threshold: 5,
    currentEvidenceCount: 12,
    lastRunEvidenceCount: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.ok(result.reason?.includes("threshold_reached"));
});

test("T7.1.2 evidence threshold policy does not trigger below threshold", () => {
  const policy: TriggerPolicy = {
    type: "evidence_threshold",
    threshold: 10,
    currentEvidenceCount: 15,
    lastRunEvidenceCount: 10,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, false);
  assert.ok(result.reason?.includes("below_threshold"));
});

test("T7.1.2 manual policy always triggers", () => {
  const policy: TriggerPolicy = { type: "manual" };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "manual_trigger");
});

test("T7.1.2 first cron run triggers immediately", () => {
  const policy: TriggerPolicy = {
    type: "cron",
    intervalHours: 24,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "first_run");
});
