import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ingestRhythmSignal, type HeartbeatSignal, type HeartbeatDeps } from "../../../src/core/second-nature/heartbeat/index.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";

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
