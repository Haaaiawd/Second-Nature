import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { assetRegistry, proposalRecords } from "../../../src/storage/db/schema/index.js";
import { runStartupRepairAndBackup } from "../../../src/storage/bootstrap/repair.js";

test("startup repair fixes orphan index, updates stale hash, rejects stale proposals, and exports backup", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-repair-workspace-"));
  const backupsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-repair-backups-"));
  const dbPath = path.join(os.tmpdir(), `sn-repair-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);

  const existingAssetPath = path.join(workspaceRoot, "memory", "2026-03-26.md");
  fs.mkdirSync(path.dirname(existingAssetPath), { recursive: true });
  fs.writeFileSync(existingAssetPath, "journal content updated", "utf8");

  const orphanAssetPath = path.join(workspaceRoot, "memory", "missing.md");

  const db = createStateDatabase(dbPath);
  try {
    db.sqlite.exec(`
      CREATE TABLE asset_registry (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        layer TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX asset_registry_path_idx ON asset_registry(path);

      CREATE TABLE proposal_records (
        id TEXT PRIMARY KEY,
        target_asset_id TEXT NOT NULL,
        before_hash TEXT,
        after_hash TEXT,
        status TEXT NOT NULL,
        proposed_diff TEXT NOT NULL,
        reason TEXT NOT NULL,
        supporting_sources TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT
      );
    `);

    await db.db.insert(assetRegistry).values([
      {
        id: "journal:2026-03-26",
        kind: "daily_journal",
        path: existingAssetPath,
        hash: "stale-hash",
        version: 1,
        layer: "daily_journal",
        lastIndexedAt: "2026-03-26T00:00:00.000Z",
      },
      {
        id: "journal:missing",
        kind: "daily_journal",
        path: orphanAssetPath,
        hash: "missing-hash",
        version: 1,
        layer: "daily_journal",
        lastIndexedAt: "2026-03-26T00:00:00.000Z",
      },
    ]);

    await db.db.insert(proposalRecords).values([
      {
        id: "proposal-stale",
        targetAssetId: "SOUL.md",
        beforeHash: null,
        afterHash: null,
        status: "draft",
        proposedDiff: "+hello",
        reason: "stale",
        supportingSources: "[]",
        confidence: 0.9,
        createdAt: "2026-03-01T00:00:00.000Z",
        appliedAt: null,
      },
      {
        id: "proposal-fresh",
        targetAssetId: "SOUL.md",
        beforeHash: null,
        afterHash: null,
        status: "requires_review",
        proposedDiff: "+fresh",
        reason: "fresh",
        supportingSources: "[]",
        confidence: 0.9,
        createdAt: "2026-03-26T00:00:00.000Z",
        appliedAt: null,
      },
    ]);

    const result = await runStartupRepairAndBackup(db, {
      now: new Date("2026-03-26T12:00:00.000Z"),
      staleProposalDays: 7,
      backupDir: backupsRoot,
    });

    assert.equal(result.scannedAssetCount, 2);
    assert.equal(result.repairedOrphanIndexCount, 1);
    assert.ok(result.repairedOrphanAssetIds.includes("journal:missing"));

    assert.equal(result.updatedHashCount, 1);
    assert.ok(result.updatedHashAssetIds.includes("journal:2026-03-26"));

    assert.equal(result.staleProposalCount, 1);
    assert.ok(result.staleProposalIds.includes("proposal-stale"));

    assert.ok(fs.existsSync(result.backupPath));

    const assets = await db.db.select().from(assetRegistry);
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.id, "journal:2026-03-26");
    assert.notEqual(assets[0]?.hash, "stale-hash");

    const proposals = await db.db.select().from(proposalRecords);
    const stale = proposals.find((item) => item.id === "proposal-stale");
    const fresh = proposals.find((item) => item.id === "proposal-fresh");
    assert.equal(stale?.status, "rejected");
    assert.equal(fresh?.status, "requires_review");
  } finally {
    db.close();
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
    if (fs.existsSync(workspaceRoot)) fs.rmSync(workspaceRoot, { recursive: true, force: true });
    if (fs.existsSync(backupsRoot)) fs.rmSync(backupsRoot, { recursive: true, force: true });
  }
});
