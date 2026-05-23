import test from "node:test";
import assert from "node:assert/strict";

import {
  scheduleDream,
  memoryLockPort,
  type SchedulerInput,
  type DreamStatePort,
  type ModelAssistPort,
} from "../../../src/dream/index.js";

const makeStatePort = (): DreamStatePort => ({
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
});

test("T-DQS.C.4 quiet_completion in window starts Dream async", async () => {
  const result = await scheduleDream({
    runId: "run-quiet-001",
    traceId: "trace-quiet-001",
    triggerKind: "quiet_completion",
    statePort: makeStatePort(),
  });

  assert.equal(result.status, "started");
  assert.equal(result.runId, "run-quiet-001");
});

test("T-DQS.C.4 quiet_completion with held lock returns skip:lock_held", async () => {
  const lockPort = memoryLockPort();
  const statePort = makeStatePort();

  const first = await scheduleDream({
    runId: "run-quiet-002",
    traceId: "trace-quiet-002",
    triggerKind: "quiet_completion",
    statePort,
    lockPort,
  });
  assert.equal(first.status, "started");

  const second = await scheduleDream({
    runId: "run-quiet-003",
    traceId: "trace-quiet-003",
    triggerKind: "quiet_completion",
    statePort,
    lockPort,
  });
  assert.equal(second.status, "skipped");
  assert.equal(second.reason, "skip:lock_held");
});

test("T-DQS.C.4 modelAssistPort is passed through to runDream without error", async () => {
  const modelAssistPort: ModelAssistPort = {
    async extractInsights() {
      return { insights: [], unsupportedClaims: [] };
    },
  };

  const result = await scheduleDream({
    runId: "run-model-001",
    traceId: "trace-model-001",
    triggerKind: "quiet_completion",
    statePort: makeStatePort(),
    modelAssistPort,
  });

  assert.equal(result.status, "started");
});

test("T-DQS.C.4 non-quiet trigger with held lock returns legacy lock_held_by reason", async () => {
  const lockPort = memoryLockPort();
  const statePort = makeStatePort();

  const first = await scheduleDream({
    runId: "run-manual-001",
    traceId: "trace-manual-001",
    triggerKind: "manual",
    statePort,
    lockPort,
  });
  assert.equal(first.status, "started");

  const second = await scheduleDream({
    runId: "run-manual-002",
    traceId: "trace-manual-002",
    triggerKind: "manual",
    statePort,
    lockPort,
  });
  assert.equal(second.status, "skipped");
  assert.ok(second.reason?.startsWith("lock_held_by:"));
});
