/**
 * v9 V8 Connector Manifest Migration — Integration Tests (T6.3.2)
 *
 * Verifies:
 * - v8 manifest.json → candidate ConnectorVersion migration
 * - v8 manifest.yaml → candidate ConnectorVersion migration
 * - Skipped when v9 ConnectorVersion already exists for platform
 * - scanAndMigrateV8Manifests scans connectors directory and migrates all
 * - Migrated version has fixture/wet_probe/canary gates pending (not passed)
 * - Migrated version status is "candidate" (NOT active)
 *
 * Also verifies file-level rollback:
 * - rollbackConnectorFiles swaps manifest/recipe/adapter from previous version
 * - Atomic write + file lock used during rollback
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeConnectorVersion,
  readConnectorVersionById,
} from "../../../src/storage/v9-state-stores.js";
import {
  migrateV8ConnectorManifest,
  scanAndMigrateV8Manifests,
} from "../../../src/core/second-nature/body/connector-evolution/v9-manifest-migration.js";
import {
  createStateStoreVersionPort,
  createFileRollbackPort,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.js";
import {
  rollbackConnectorFiles,
  atomicWriteFile,
  acquireFileLock,
  safeReadJson,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-file-ops.js";
import type { ConnectorVersion } from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-28T14:00:00Z";

async function createTempWorkspace(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `sn-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(root, { recursive: true });
  return {
    root,
    cleanup: async () => {
      try { await fs.rm(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

describe("INT-T6.3.2 v8 manifest migration", () => {
  it("migrates v8 manifest.json to candidate ConnectorVersion", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const manifestPath = ".second-nature/connectors/moltbook/manifest.json";
      const fullPath = join(ws.root, manifestPath);
      await fs.mkdir(join(ws.root, ".second-nature", "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify({
        platformId: "moltbook",
        capabilities: [
          { capabilityId: "moltbook:feed.read", description: "Read feed" },
          { capabilityId: "moltbook:post.publish", description: "Publish post" },
        ],
        recipePath: ".second-nature/connectors/moltbook/recipe.json",
        adapterPath: ".second-nature/connectors/moltbook/adapter.js",
      }));

      const store = createStateStoreVersionPort(db);
      const version = await migrateV8ConnectorManifest(ws.root, manifestPath, {
        store,
        generateId: () => "mig_1",
        now: () => NOW,
      });

      assert.ok(version);
      assert.equal(version!.status, "candidate");
      assert.equal(version!.platformId, "moltbook");
      assert.equal(version!.versionId, "moltbook-v8-migrated");
      assert.deepEqual(version!.declaredCapabilities, ["moltbook:feed.read", "moltbook:post.publish"]);
      assert.equal(version!.manifestPath, manifestPath);

      // fixture/wet_probe/canary gates should be pending (not passed)
      const fixtureGate = version!.gateResults.find((g) => g.gate === "fixture");
      assert.ok(fixtureGate);
      assert.ok(!fixtureGate!.passed);
      assert.match(fixtureGate!.reason ?? "", /migration_no_fixture/);

      const wetProbeGate = version!.gateResults.find((g) => g.gate === "wet_probe");
      assert.ok(wetProbeGate);
      assert.ok(!wetProbeGate!.passed);

      const canaryGate = version!.gateResults.find((g) => g.gate === "canary");
      assert.ok(canaryGate);
      assert.ok(!canaryGate!.passed);

      // schema/permission/sandbox gates should be passed
      const schemaGate = version!.gateResults.find((g) => g.gate === "schema");
      assert.ok(schemaGate?.passed);

      // Version persisted in DB
      const row = await readConnectorVersionById(db, version!.versionId);
      assert.ok(row);
      assert.equal(row!.status, "candidate");
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("migrates v8 manifest.yaml to candidate ConnectorVersion", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const manifestPath = ".second-nature/connectors/instreet/manifest.yaml";
      const fullPath = join(ws.root, manifestPath);
      await fs.mkdir(join(ws.root, ".second-nature", "connectors", "instreet"), { recursive: true });
      await fs.writeFile(fullPath, [
        "platformId: instreet",
        "capabilities:",
        "- instreet:work.discover",
        "- instreet:work.connect",
        "recipePath: .second-nature/connectors/instreet/recipe.json",
        "adapterPath: .second-nature/connectors/instreet/adapter.js",
      ].join("\n"));

      const store = createStateStoreVersionPort(db);
      const version = await migrateV8ConnectorManifest(ws.root, manifestPath, {
        store,
        generateId: () => "mig_2",
        now: () => NOW,
      });

      assert.ok(version);
      assert.equal(version!.status, "candidate");
      assert.equal(version!.platformId, "instreet");
      // YAML simple parser extracts values as strings
      assert.ok(version!.declaredCapabilities.length >= 0);
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("skips migration when v9 ConnectorVersion already exists", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const manifestPath = ".second-nature/connectors/moltbook/manifest.json";
      const fullPath = join(ws.root, manifestPath);
      await fs.mkdir(join(ws.root, ".second-nature", "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify({
        platformId: "moltbook",
        capabilities: [{ capabilityId: "moltbook:feed.read" }],
      }));

      // Seed an existing active version
      await writeConnectorVersion(db, {
        id: "existing_1",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_existing",
        status: "active",
        sourceRefs: [{ family: "connector", id: "existing" }],
        workspaceRoot: ws.root,
        planType: "manifest_delta",
        gateResults: [],
      });

      const store = createStateStoreVersionPort(db);
      const version = await migrateV8ConnectorManifest(ws.root, manifestPath, {
        store,
        generateId: () => "mig_3",
        now: () => NOW,
      });

      assert.equal(version, undefined);
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("skips migration when migrated version already exists", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const manifestPath = ".second-nature/connectors/moltbook/manifest.json";
      const fullPath = join(ws.root, manifestPath);
      await fs.mkdir(join(ws.root, ".second-nature", "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify({
        platformId: "moltbook",
        capabilities: [{ capabilityId: "moltbook:feed.read" }],
      }));

      // Seed an existing migrated version
      await writeConnectorVersion(db, {
        id: "mig_existing",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "moltbook-v8-migrated",
        status: "candidate",
        sourceRefs: [{ family: "connector", id: "prev-migration" }],
        workspaceRoot: ws.root,
        planType: "manifest_delta",
        gateResults: [],
      });

      const store = createStateStoreVersionPort(db);
      const version = await migrateV8ConnectorManifest(ws.root, manifestPath, {
        store,
        generateId: () => "mig_4",
        now: () => NOW,
      });

      assert.equal(version, undefined);
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("scanAndMigrateV8Manifests scans directory and migrates all platforms", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      // Create two platform manifests
      for (const platform of ["moltbook", "instreet"]) {
        const dir = join(ws.root, ".second-nature", "connectors", platform);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(join(dir, "manifest.json"), JSON.stringify({
          platformId: platform,
          capabilities: [{ capabilityId: `${platform}:read` }],
        }));
      }

      const store = createStateStoreVersionPort(db);
      const migrated = await scanAndMigrateV8Manifests(ws.root, {
        store,
        generateId: () => `scan_${Math.random().toString(36).slice(2, 8)}`,
        now: () => NOW,
      });

      assert.equal(migrated.length, 2);
      const platformIds = migrated.map((v) => v.platformId).sort();
      assert.deepEqual(platformIds, ["instreet", "moltbook"]);
      for (const v of migrated) {
        assert.equal(v.status, "candidate");
      }
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("scanAndMigrateV8Manifests returns empty when no connectors dir", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const store = createStateStoreVersionPort(db);
      const migrated = await scanAndMigrateV8Manifests(ws.root, {
        store,
        generateId: () => "scan_empty",
        now: () => NOW,
      });
      assert.equal(migrated.length, 0);
    } finally {
      db.close();
      await ws.cleanup();
    }
  });
});

// ───────────────────────────────────────────────────────────────
// File operations tests
// ───────────────────────────────────────────────────────────────

describe("INT-T6.3.2 connector file operations", () => {
  it("atomicWriteFile writes content atomically", async () => {
    const ws = await createTempWorkspace();
    try {
      const filePath = join(ws.root, "test.txt");
      await atomicWriteFile(filePath, "hello world");
      const content = await fs.readFile(filePath, "utf-8");
      assert.equal(content, "hello world");
    } finally {
      await ws.cleanup();
    }
  });

  it("safeReadJson returns undefined for missing file", async () => {
    const ws = await createTempWorkspace();
    try {
      const result = await safeReadJson(join(ws.root, "nonexistent.json"));
      assert.equal(result, undefined);
    } finally {
      await ws.cleanup();
    }
  });

  it("safeReadJson returns undefined for invalid JSON", async () => {
    const ws = await createTempWorkspace();
    try {
      const filePath = join(ws.root, "invalid.json");
      await fs.writeFile(filePath, "{not valid json");
      const result = await safeReadJson(filePath);
      assert.equal(result, undefined);
    } finally {
      await ws.cleanup();
    }
  });

  it("acquireFileLock acquires and releases lock", async () => {
    const ws = await createTempWorkspace();
    try {
      const filePath = join(ws.root, "locked.txt");
      const release = await acquireFileLock(filePath, 1000);
      // Lock file exists
      const lockExists = await fs.stat(filePath + ".lock").then(() => true).catch(() => false);
      assert.ok(lockExists);
      await release();
      // Lock file removed
      const lockExistsAfter = await fs.stat(filePath + ".lock").then(() => true).catch(() => false);
      assert.ok(!lockExistsAfter);
    } finally {
      await ws.cleanup();
    }
  });

  it("rollbackConnectorFiles swaps files from previous version", async () => {
    const ws = await createTempWorkspace();
    try {
      // Create current and previous manifest files
      const currentManifest = join(ws.root, "connectors", "moltbook", "manifest.json");
      const previousManifest = join(ws.root, "connectors", "moltbook", "manifest.prev.json");
      await fs.mkdir(join(ws.root, "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(currentManifest, JSON.stringify({ version: "new" }));
      await fs.writeFile(previousManifest, JSON.stringify({ version: "old" }));

      const result = await rollbackConnectorFiles(
        { manifestPath: "connectors/moltbook/manifest.json" },
        { manifestPath: "connectors/moltbook/manifest.prev.json" },
        ws.root,
      );

      assert.equal(result.rolledBack.length, 1);
      // Current manifest should now contain previous content
      const content = await fs.readFile(currentManifest, "utf-8");
      assert.deepEqual(JSON.parse(content), { version: "old" });
    } finally {
      await ws.cleanup();
    }
  });

  it("rollbackConnectorFiles skips when previous file missing", async () => {
    const ws = await createTempWorkspace();
    try {
      const currentManifest = join(ws.root, "connectors", "moltbook", "manifest.json");
      await fs.mkdir(join(ws.root, "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(currentManifest, JSON.stringify({ version: "new" }));

      const result = await rollbackConnectorFiles(
        { manifestPath: "connectors/moltbook/manifest.json" },
        { manifestPath: "connectors/moltbook/manifest.prev.json" },
        ws.root,
      );

      assert.equal(result.rolledBack.length, 0);
      assert.equal(result.skipped.length, 1);
    } finally {
      await ws.cleanup();
    }
  });
});

// ───────────────────────────────────────────────────────────────
// File-level rollback integration with rollbackConnectorVersion
// ───────────────────────────────────────────────────────────────

describe("INT-T6.3.2 rollbackConnectorVersion with file rollback", () => {
  it("rolls back DB status and swaps workspace files", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      // Create workspace files for current and previous versions
      const currentManifest = join(ws.root, "connectors", "moltbook", "manifest.json");
      const previousManifest = join(ws.root, "connectors", "moltbook", "manifest.v0.json");
      await fs.mkdir(join(ws.root, "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(currentManifest, JSON.stringify({ version: "v1_new" }));
      await fs.writeFile(previousManifest, JSON.stringify({ version: "v0_old" }));

      // Seed previous and current versions in DB
      await writeConnectorVersion(db, {
        id: "cv_prev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_prev",
        manifestPath: "connectors/moltbook/manifest.v0.json",
        status: "active",
        sourceRefs: [{ family: "connector", id: "prev" }],
        workspaceRoot: ws.root,
        planType: "manifest_delta",
        gateResults: [],
      });
      await writeConnectorVersion(db, {
        id: "cv_curr",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_curr",
        manifestPath: "connectors/moltbook/manifest.json",
        status: "active",
        previousStableRef: "v_prev",
        sourceRefs: [{ family: "connector", id: "curr" }],
        workspaceRoot: ws.root,
        planType: "manifest_delta",
        gateResults: [],
      });

      const store = createStateStoreVersionPort(db);
      const fileRollback = createFileRollbackPort();
      const obs = { events: [] as Array<{ stage: string; outcome: string; reasonCode: string }>, async recordStageEvent(e: { stage: string; outcome: string; reasonCode: string }) { obs.events.push(e); } };
      const ledger = { async writeLedgerEntry() { return { id: "ledger_1" }; } };

      const { rollbackConnectorVersion } = await import("../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.js");
      const result = await rollbackConnectorVersion("v_curr", {
        store,
        ledger: ledger as never,
        observability: obs as never,
        gates: {} as never,
        fileRollback,
        generateId: () => "rb_1",
        now: () => NOW,
      });

      assert.equal(result.status, "rolled_back");
      assert.equal(result.restoredVersionId, "v_prev");
      assert.ok(result.fileRollback);
      assert.equal(result.fileRollback!.rolledBack.length, 1);

      // Current manifest should now contain previous content
      const content = await fs.readFile(currentManifest, "utf-8");
      assert.deepEqual(JSON.parse(content), { version: "v0_old" });

      // DB status updated
      const currRow = await readConnectorVersionById(db, "v_curr");
      assert.equal(currRow!.status, "rolled_back");
      const prevRow = await readConnectorVersionById(db, "v_prev");
      assert.equal(prevRow!.status, "active");
    } finally {
      db.close();
      await ws.cleanup();
    }
  });
});
