import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ingestRhythmSignal,
  type HeartbeatSignal,
  type HeartbeatDeps,
} from "../../../src/core/second-nature/heartbeat/index.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";

test("T2.3.3 quiet non-empty: unresolved evidence refs -> denied (low path)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-quiet-low-"));
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T22:30:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    quietEnabledBridge: true,
    lifeEvidenceRefs: [{ id: "bad", kind: "connector_result", uri: "" }],
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => snapshotInputs,
    quietWorkflow: { workspaceRoot: tmp },
  };

  const result = await ingestRhythmSignal(signal, deps);
  assert.equal(result.status, "denied");
  assert.ok(result.reasons.some((x) => x.includes("unresolved_source_refs")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("T2.3.3 quiet non-empty: sensitive source refs are denied and not persisted", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-quiet-sensitive-"));
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T22:30:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    quietEnabledBridge: true,
    lifeEvidenceRefs: [{ id: "secret-ref", kind: "connector_result", uri: "credential://github/token" }],
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => snapshotInputs,
    quietWorkflow: { workspaceRoot: tmp },
  };

  const result = await ingestRhythmSignal(signal, deps);
  assert.equal(result.status, "denied");
  assert.ok(result.reasons.includes("quiet_guidance_sensitive_source_blocked"));
  const quietDir = path.join(tmp, ".second-nature", "quiet", "2026-05-02");
  assert.equal(fs.existsSync(quietDir), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("T2.3.3 quiet non-empty: grounded evidence -> intent_selected with quiet artifact hints", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-quiet-ok-"));
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T22:30:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    quietEnabledBridge: true,
    lifeEvidenceRefs: [{ id: "good", kind: "connector_result", uri: "https://example.com/evidence/1" }],
    userInterestSnapshot: {
      snapshotId: "snap-1",
      generatedAt: "2026-05-02T22:00:00.000Z",
      staleness: "fresh",
      confidence: 0.9,
      signals: [
        {
          id: "sig1",
          topic: "project alpha",
          affinity: "positive",
          reason: "integration_fixture",
          confidence: 0.9,
          sourceRefs: [],
          updatedAt: "2026-05-02T22:00:00.000Z",
        },
      ],
      sourceRefs: [],
    },
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => snapshotInputs,
    quietWorkflow: { workspaceRoot: tmp },
  };

  const result = await ingestRhythmSignal(signal, deps);
  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.some((x) => x === "quiet_artifact_written"));
  const day = "2026-05-02";
  const quietDir = path.join(tmp, ".second-nature", "quiet", day);
  assert.ok(fs.existsSync(quietDir), `expected quiet dir at ${quietDir}`);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("T2.3.3 quiet mode + quietWorkflow persists empty_state artifact", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-quiet-"));
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: "2026-05-02T22:30:00.000Z" },
  };
  const snapshotInputs: SnapshotInputs = {
    mode: "quiet",
    currentWindowId: "window-quiet",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    quietEnabledBridge: true,
  };

  const deps: HeartbeatDeps = {
    loadSnapshotInputs: async () => snapshotInputs,
    quietWorkflow: { workspaceRoot: tmp },
  };

  const result = await ingestRhythmSignal(signal, deps);
  assert.equal(result.status, "intent_selected");
  assert.ok(result.reasons.some((x) => x.includes("quiet_empty_state") || x.includes("no_fictional")));
  const day = "2026-05-02";
  const quietDir = path.join(tmp, ".second-nature", "quiet", day);
  assert.ok(fs.existsSync(quietDir), `expected quiet dir at ${quietDir}`);
  const files = fs.readdirSync(quietDir);
  assert.ok(files.some((f) => f.endsWith(".json")));
  fs.rmSync(tmp, { recursive: true, force: true });
});
