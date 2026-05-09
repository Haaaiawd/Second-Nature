import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { appendLifeEvidence, loadLifeEvidenceSnapshot, loadContinuitySnapshot } from "../../../src/storage/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

test("T4.2.1 loadLifeEvidenceSnapshot returns empty safe snapshot", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-snap-empty-"));

  const snap = await loadLifeEvidenceSnapshot(state, ws, {});
  assert.equal(snap.empty, true);
  assert.equal(snap.platformEvents.length, 0);
  assert.equal(snap.workEvents.length, 0);
  state.close();
});

test("T4.2.1 loadLifeEvidenceSnapshot classifies platform vs work evidence", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-snap-mix-"));

  await appendLifeEvidence(state, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "platform_browse",
    summary: "browse",
    sourceRefs: [{ id: "a", kind: "platform_item", uri: "p://a" }],
    sensitivity: "public",
    producer: "connector-system",
  });
  await appendLifeEvidence(state, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "task_discovery",
    summary: "task",
    sourceRefs: [{ id: "b", kind: "platform_item", uri: "p://b" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  const snap = await loadLifeEvidenceSnapshot(state, ws, { limit: 10 });
  assert.equal(snap.empty, false);
  assert.equal(snap.platformEvents.length, 1);
  assert.equal(snap.workEvents.length, 1);
  state.close();
});

test("T4.2.1 loadContinuitySnapshot exposes quietDebt from evidence", async () => {
  const state = createStateDatabase(":memory:");
  const obs = createObservabilityDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-cont-"));

  await appendLifeEvidence(state, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "work_progress",
    summary: "w",
    sourceRefs: [{ id: "c", kind: "platform_item", uri: "p://c" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  const cont = await loadContinuitySnapshot({ state, workspaceRoot: ws, observability: obs });
  assert.equal(cont.quietDebt.hasUnprocessedEvidence, true);
  assert.ok(cont.quietDebt.pendingCount >= 1);
  state.close();
  obs.close();
});
