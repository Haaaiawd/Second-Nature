import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

import { appendLifeEvidence } from "../../../src/storage/life-evidence/append-life-evidence.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { lifeEvidenceIndex } from "../../../src/storage/db/schema/life-evidence-index.js";

test("appendLifeEvidence writes artifact and index row", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-"));

  const ack = await appendLifeEvidence(state, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "platform_browse",
    platformId: "moltbook",
    summary: "Browsed feed",
    sourceRefs: [{ id: "src-1", kind: "platform_item", uri: "moltbook://item/1" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  assert.ok(ack.evidenceId.length > 0);
  const artifactPath = path.join(ws, ".second-nature", "evidence", `${ack.evidenceId}.json`);
  assert.equal(fs.existsSync(artifactPath), true);

  const rows = await state.db.select().from(lifeEvidenceIndex).where(eq(lifeEvidenceIndex.id, ack.evidenceId));
  assert.equal(rows.length, 1);
  state.close();
});

test("appendLifeEvidence rejects empty sourceRefs", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-"));

  await assert.rejects(
    () =>
      appendLifeEvidence(state, ws, {
        timestamp: new Date().toISOString(),
        evidenceType: "platform_browse",
        summary: "bad",
        sourceRefs: [],
        sensitivity: "public",
        producer: "connector-system",
      }),
    /life_evidence_missing_source_refs/,
  );
  state.close();
});

test("appendLifeEvidence rejects credential sensitivity", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-"));

  await assert.rejects(
    () =>
      appendLifeEvidence(state, ws, {
        timestamp: new Date().toISOString(),
        evidenceType: "platform_browse",
        summary: "secret",
        sourceRefs: [{ id: "src-1", kind: "platform_item", uri: "x" }],
        sensitivity: "credential",
        producer: "connector-system",
      }),
    /life_evidence_credential_rejected/,
  );
  state.close();
});
