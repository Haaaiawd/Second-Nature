/**
 * v9 AutonomousChangeLedger Integration Test (T8.1.1).
 *
 * Verifies that the ledger write/read port persists canonical entries to the
 * state database and supports query filters used by routine install and
 * connector evolution.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeAutonomousChangeLedger,
  readAutonomousChangeLedgerById,
  readAutonomousChangeLedgerByTarget,
  readAutonomousChangeLedgerByStatus,
  updateAutonomousChangeLedgerStatus,
  readCharacterFrameById,
  writeCharacterFrame,
  updateCharacterFrameStatus,
} from "../../../src/storage/v9-state-stores.js";
import type { SourceRef } from "../../../src/shared/types/v9-contracts.js";

const NOW = new Date("2026-06-26T00:00:00Z").toISOString();

function sourceRef(family: SourceRef["family"], id: string): SourceRef {
  return { family, id };
}

describe("INT-T8.1.1 autonomous-change-ledger", () => {
  it("persists ledger entry with source refs and queries by target/status", async () => {
    const db = createStateDatabase(":memory:");

    const entry = await writeAutonomousChangeLedger(db, {
      id: "ledger-1",
      createdAt: NOW,
      workspaceRoot: "/workspace",
      changeKind: "connector_manifest_delta",
      targetId: "moltbook",
      previousStableRef: "git:stable-1",
      status: "proposed",
      rollbackCommandHint: "sn connector rollback moltbook",
      sourceRefs: [sourceRef("connector", "moltbook")],
      redactedPayloadJson: JSON.stringify({ manifestPath: ".second-nature/connectors/moltbook/manifest.yaml" }),
    });

    const byId = await readAutonomousChangeLedgerById(db, entry.id);
    assert.ok(byId);
    assert.equal(byId?.changeKind, "connector_manifest_delta");
    assert.equal(byId?.targetId, "moltbook");

    const byTarget = await readAutonomousChangeLedgerByTarget(db, "moltbook");
    assert.equal(byTarget.rows.length, 1);
    assert.equal(byTarget.rows[0]?.id, "ledger-1");

    const byStatus = await readAutonomousChangeLedgerByStatus(db, "proposed");
    assert.ok(byStatus.rows.some((r) => r.id === "ledger-1"));
  });

  it("updates status and rollback metadata", async () => {
    const db = createStateDatabase(":memory:");

    await writeAutonomousChangeLedger(db, {
      id: "ledger-2",
      createdAt: NOW,
      workspaceRoot: "/workspace",
      changeKind: "routine_install",
      targetId: "routine-x",
      status: "proposed",
      sourceRefs: [sourceRef("routine", "routine-x")],
    });

    const updated = await updateAutonomousChangeLedgerStatus(db, "ledger-2", "activated", {
      rollbackRef: "git:before-routine-x",
      activatedAt: NOW,
    });

    assert.equal(updated?.status, "activated");
    assert.equal(updated?.rollbackRef, "git:before-routine-x");
    assert.equal(updated?.activatedAt, NOW);
  });

  it("returns degraded on read when database is closed", async () => {
    const db = createStateDatabase(":memory:");
    await writeAutonomousChangeLedger(db, {
      id: "ledger-3",
      createdAt: NOW,
      workspaceRoot: "/workspace",
      changeKind: "routine_retire",
      targetId: "routine-y",
      status: "proposed",
      sourceRefs: [sourceRef("routine", "routine-y")],
    });

    await db.db.run("PRAGMA schema_version"); // ensure writable
    // Force close to simulate degraded read
    await db.close();

    const result = await readAutonomousChangeLedgerByStatus(db, "proposed");
    assert.equal(result.rows.length, 0);
    assert.ok(result.degraded);
    assert.equal(result.degraded?.reason, "state_unreadable");
  });

  it("character frame storage supports supersede lifecycle with valid_until", async () => {
    const db = createStateDatabase(":memory:");

    const frame = await writeCharacterFrame(db, {
      id: "frame-1",
      createdAt: NOW,
      version: 1,
      validFrom: NOW,
      status: "accepted",
      sectionsJson: JSON.stringify({ habits: [] }),
      contestPrompt: "contest?",
      charCount: 42,
      sourceRefs: [sourceRef("character", "frame-1")],
      acceptedAt: NOW,
    });

    const read = await readCharacterFrameById(db, frame.id);
    assert.equal(read?.status, "accepted");
    assert.equal(read?.version, 1);
    assert.equal(read?.validFrom, NOW);
    assert.equal(read?.charCount, 42);

    await updateCharacterFrameStatus(db, "frame-1", "superseded", {
      supersededBy: "frame-2",
      validUntil: NOW,
      revisionOf: "frame-0",
      charCount: 42,
    });
    const superseded = await readCharacterFrameById(db, "frame-1");
    assert.equal(superseded?.status, "superseded");
    assert.equal(superseded?.validUntil, NOW);
    assert.equal(superseded?.revisionOf, "frame-0");
    assert.equal(superseded?.charCount, 42);
  });
});
