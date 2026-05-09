import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

import { appendLifeEvidence, repairStateIndexes } from "../../../src/storage/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { lifeEvidenceIndex } from "../../../src/storage/db/schema/life-evidence-index.js";

test("T4.1.3 repairStateIndexes backfills missing life_evidence_index rows", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-repair-"));

  await appendLifeEvidence(state, ws, {
    timestamp: new Date().toISOString(),
    evidenceType: "platform_browse",
    summary: "x",
    sourceRefs: [{ id: "s1", kind: "platform_item", uri: "p://1" }],
    sensitivity: "public",
    producer: "connector-system",
  });

  const idRows = await state.db.select().from(lifeEvidenceIndex);
  const evidenceId = idRows[0]!.id;
  await state.db.delete(lifeEvidenceIndex).where(eq(lifeEvidenceIndex.id, evidenceId));

  const repair = await repairStateIndexes(state, { startupGate: true, workspaceRoot: ws });
  assert.equal(repair.status, "ok");
  assert.ok(repair.repairedEvidenceIndexRows >= 1);

  const again = await state.db.select().from(lifeEvidenceIndex).where(eq(lifeEvidenceIndex.id, evidenceId));
  assert.equal(again.length, 1);
  state.close();
});

test("T4.1.3 startupGate returns repair_required on corrupt evidence json", async () => {
  const state = createStateDatabase(":memory:");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sn-repair-bad-"));
  const dir = path.join(ws, ".second-nature", "evidence");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bad.json"), "{ not json", "utf-8");

  const repair = await repairStateIndexes(state, { startupGate: true, workspaceRoot: ws });
  assert.equal(repair.status, "repair_required");
  assert.ok(repair.repairNotes.some((n) => n.startsWith("corrupt_evidence_json")));
  state.close();
});
