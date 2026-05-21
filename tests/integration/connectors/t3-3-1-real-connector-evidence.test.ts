/**
 * T3.3.1 — Real connector evidence writeback integration.
 *
 * Acceptance:
 * A. connector success with source-backed data → LifeEvidence artifact + index written.
 * B. connector success with empty data → no evidence fabricated.
 * C. connector failure → no evidence fabricated, honest attempt only.
 * D. missing state/workspaceRoot → cycle completes without evidence write.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { resolveAllowedIntentResult } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";
import type { FailureClass } from "../../../src/connectors/base/failure-taxonomy.js";
import type { CandidateIntent, ContinuitySnapshot } from "../../../src/core/second-nature/types.js";
import type { HeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import { loadLifeEvidenceSnapshot } from "../../../src/storage/snapshots/life-evidence-snapshot.js";

function makeTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-t3-3-1-"));
  fs.mkdirSync(path.join(dir, ".second-nature", "evidence"), { recursive: true });
  return dir;
}

function createCandidateIntent(overrides?: Partial<CandidateIntent>): CandidateIntent {
  return {
    id: "intent-exploration-001",
    kind: "exploration",
    priority: 70,
    source: "tick",
    platformId: "moltbook",
    summary: "scan platform opportunities",
    effectClass: "connector_action",
    sourceRefs: [{ id: "ref-1", kind: "workspace_artifact", uri: "workspace://test" }],
    idempotencyKey: "exploration:scan",
    goalInfluenceRefs: [],
    ...overrides,
  };
}

function createRuntimeSnapshot(): HeartbeatRuntimeSnapshot {
  const continuity: ContinuitySnapshot = {
    mode: "active",
    currentWindowId: "default",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
  };
  return {
    continuity,
    lifeEvidence: {
      evidenceRefs: [],
      platformEventCount: 0,
      workEventCount: 0,
    },
    rhythmWindow: {
      windowId: "default",
      allowedIntentKinds: ["exploration", "work", "social", "quiet", "reflection", "outreach", "maintenance"],
      quietBias: false,
    },
    hardGuards: {
      hasDuplicateIntent: () => false,
      isOutreachCooldownClear: () => true,
    },
  };
}

function createSnapshotInputs(): SnapshotInputs {
  return {
    mode: "active",
    currentWindowId: "default",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
  };
}

function createSignal(): HeartbeatSignal {
  return {
    trigger: "heartbeat_bridge",
    payload: { timestamp: new Date().toISOString() },
  } as HeartbeatSignal;
}

function mockConnectorResult(
  status: ConnectorResult<unknown>["status"],
  data?: unknown,
  failureClass?: FailureClass,
): ConnectorResult<unknown> {
  return {
    status,
    data,
    failureClass,
    metadata: {
      platformId: "moltbook",
      channel: "api_rest",
      latencyMs: 120,
    },
  };
}

test("T3.3.1-A: connector success with sourceRefs writes life evidence artifact + index", async () => {
  const workspaceRoot = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");

  const result = await resolveAllowedIntentResult(
    createCandidateIntent(),
    createRuntimeSnapshot(),
    createSnapshotInputs(),
    createSignal(),
    {
      connectorExecutor: {
        executeEffect: async () =>
          mockConnectorResult("success", {
            items: [
              { id: "post-001", title: "Hello World" },
              { id: "post-002", title: "Second Post" },
            ],
          }),
      },
      state: stateDb,
      workspaceRoot,
    },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.includes("connector_effect_executed"));

  // Verify evidence was written to DB index
  const snapshot = await loadLifeEvidenceSnapshot(stateDb, workspaceRoot, { limit: 10 }, { runRepairGate: false });
  assert.ok(!snapshot.empty, "evidence snapshot must not be empty");
  const totalCount = snapshot.platformEvents.length + snapshot.workEvents.length + snapshot.userInteractionEvents.length;
  assert.ok(totalCount > 0, "at least one evidence row must exist");
  assert.ok(
    snapshot.platformEvents.some((ev) =>
      ev.sourceRefs.some((ref) => ref.id.includes("post-001") || ref.kind === "platform_item")
    ),
    "evidence must contain platform item refs",
  );

  // Verify artifact file exists
  const evidenceDir = path.join(workspaceRoot, ".second-nature", "evidence");
  const files = fs.readdirSync(evidenceDir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 0, "artifact JSON must be written");

  // Cleanup
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

test("T3.3.1-B: connector success with empty data does not fabricate evidence", async () => {
  const workspaceRoot = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");

  const result = await resolveAllowedIntentResult(
    createCandidateIntent(),
    createRuntimeSnapshot(),
    createSnapshotInputs(),
    createSignal(),
    {
      connectorExecutor: {
        executeEffect: async () => mockConnectorResult("success", { items: [] }),
      },
      state: stateDb,
      workspaceRoot,
    },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.includes("connector_effect_executed"));

  // Verify no evidence was written
  const snapshot = await loadLifeEvidenceSnapshot(stateDb, workspaceRoot, { limit: 10 }, { runRepairGate: false });
  assert.equal(snapshot.empty, true, "empty connector result must not produce evidence");
  assert.equal(snapshot.platformEvents.length + snapshot.workEvents.length + snapshot.userInteractionEvents.length, 0);

  // Cleanup
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

test("T3.3.1-C: connector failure does not fabricate evidence", async () => {
  const workspaceRoot = makeTempWorkspace();
  const stateDb = createStateDatabase(":memory:");

  const result = await resolveAllowedIntentResult(
    createCandidateIntent(),
    createRuntimeSnapshot(),
    createSnapshotInputs(),
    createSignal(),
    {
      connectorExecutor: {
        executeEffect: async () => mockConnectorResult("terminal_failure", undefined, "transport_failure"),
      },
      state: stateDb,
      workspaceRoot,
    },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.includes("connector_terminal_failure"));

  // Verify no evidence was written
  const snapshot = await loadLifeEvidenceSnapshot(stateDb, workspaceRoot, { limit: 10 }, { runRepairGate: false });
  assert.equal(snapshot.empty, true, "failure must not produce fabricated evidence");

  // Cleanup
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

test("T3.3.1-D: missing state/workspaceRoot does not crash cycle", async () => {
  const result = await resolveAllowedIntentResult(
    createCandidateIntent(),
    createRuntimeSnapshot(),
    createSnapshotInputs(),
    createSignal(),
    {
      connectorExecutor: {
        executeEffect: async () =>
          mockConnectorResult("success", {
            items: [{ id: "post-003" }],
          }),
      },
      // No state, no workspaceRoot
    },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.includes("connector_effect_executed"));
});
