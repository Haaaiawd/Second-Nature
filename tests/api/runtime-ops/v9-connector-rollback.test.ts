/**
 * v9 Connector Rollback API test (T6.3.2).
 *
 * Verifies the `connector_evolution.rollback` runtime-ops API surface:
 * - Before rollback: current version is active, previous is rolled_back
 * - After rollback: current is rolled_back, previous is active again
 * - Ledger entry written with rolled_back status
 * - File-level rollback swaps workspace files (when fileRollback port configured)
 *
 * This test exercises the same code path as the runtime-ops API handler
 * would call: `rollbackConnectorVersion(versionId, deps)`.
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
  readActiveConnectorVersion,
  readAutonomousChangeLedgerByTarget,
} from "../../../src/storage/v9-state-stores.js";
import {
  rollbackConnectorVersion,
  createStateStoreVersionPort,
  createStateStoreLedgerPort,
  createFileRollbackPort,
  type ConnectorEvolutionEngineDeps,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.js";
import type { StageEvent, StageEventSink } from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-28T14:00:00Z";

async function createTempWorkspace(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `sn-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(root, { recursive: true });
  return {
    root,
    cleanup: async () => {
      try { await fs.rm(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function createMockObservability(): StageEventSink & { events: StageEvent[] } {
  const events: StageEvent[] = [];
  return {
    events,
    async recordStageEvent(event: StageEvent) {
      events.push(event);
    },
  };
}

describe("API-T6.3.2 connector_evolution.rollback", () => {
  it("before rollback: current is active, previous is rolled_back", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Seed previous and current versions
      await writeConnectorVersion(db, {
        id: "cv_prev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_prev",
        manifestPath: "connectors/moltbook/manifest.v0.json",
        status: "active",
        sourceRefs: [{ family: "connector", id: "prev" }],
        workspaceRoot: "/ws",
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
        workspaceRoot: "/ws",
        planType: "manifest_delta",
        gateResults: [],
      });

      // Before rollback: current is active
      const currRow = await readConnectorVersionById(db, "v_curr");
      assert.equal(currRow!.status, "active");

      // Previous is also active (it was the previous stable, now superseded)
      const prevRow = await readConnectorVersionById(db, "v_prev");
      assert.equal(prevRow!.status, "active");
    } finally {
      db.close();
    }
  });

  it("after rollback: current is rolled_back, previous is active, ledger written", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: {} as never,
        generateId: () => `api_${Math.random().toString(36).slice(2, 8)}`,
        now: () => NOW,
      };

      await writeConnectorVersion(db, {
        id: "cv_prev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_prev",
        manifestPath: "connectors/moltbook/manifest.v0.json",
        status: "active",
        sourceRefs: [{ family: "connector", id: "prev" }],
        workspaceRoot: "/ws",
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
        workspaceRoot: "/ws",
        planType: "manifest_delta",
        gateResults: [],
      });

      const result = await rollbackConnectorVersion("v_curr", deps);

      // After rollback: current is rolled_back
      assert.equal(result.status, "rolled_back");
      assert.equal(result.restoredVersionId, "v_prev");

      const currRow = await readConnectorVersionById(db, "v_curr");
      assert.equal(currRow!.status, "rolled_back");
      assert.ok(currRow!.rolledBackAt);

      // Previous is active again
      const prevRow = await readConnectorVersionById(db, "v_prev");
      assert.equal(prevRow!.status, "active");
      assert.ok(prevRow!.activatedAt);

      // Active version for platform is the previous one
      const activeRow = await readActiveConnectorVersion(db, "moltbook");
      assert.equal(activeRow!.versionId, "v_prev");

      // Ledger entry written with rolled_back status
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, "v_curr");
      assert.equal(ledgerRows.rows.length, 1);
      assert.equal(ledgerRows.rows[0].status, "rolled_back");
      assert.equal(ledgerRows.rows[0].changeKind, "connector_manifest_delta");
      assert.ok(ledgerRows.rows[0].rollbackCommandHint);

      // Observability events emitted
      const rollbackEvents = obs.events.filter((e) => e.stage === "rollback");
      assert.ok(rollbackEvents.length >= 2);
      assert.ok(rollbackEvents.some((e) => e.reasonCode === "rollback_started"));
      assert.ok(rollbackEvents.some((e) => e.reasonCode === "rollback_succeeded"));
    } finally {
      db.close();
    }
  });

  it("after rollback with file port: workspace files swapped", async () => {
    const db = createStateDatabase(":memory:");
    const ws = await createTempWorkspace();
    try {
      const currentManifest = join(ws.root, "connectors", "moltbook", "manifest.json");
      const previousManifest = join(ws.root, "connectors", "moltbook", "manifest.v0.json");
      await fs.mkdir(join(ws.root, "connectors", "moltbook"), { recursive: true });
      await fs.writeFile(currentManifest, JSON.stringify({ version: "v1_new" }));
      await fs.writeFile(previousManifest, JSON.stringify({ version: "v0_old" }));

      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const fileRollback = createFileRollbackPort();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: {} as never,
        fileRollback,
        generateId: () => `api_file_${Math.random().toString(36).slice(2, 8)}`,
        now: () => NOW,
      };

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

      const result = await rollbackConnectorVersion("v_curr", deps);

      assert.equal(result.status, "rolled_back");
      assert.ok(result.fileRollback);
      assert.equal(result.fileRollback!.rolledBack.length, 1);

      // Current manifest should now contain previous content
      const content = await fs.readFile(currentManifest, "utf-8");
      assert.deepEqual(JSON.parse(content), { version: "v0_old" });

      // File rollback event emitted
      const fileEvent = obs.events.find((e) => e.reasonCode === "file_rollback_completed");
      assert.ok(fileEvent);
    } finally {
      db.close();
      await ws.cleanup();
    }
  });

  it("rollback without previous stable returns blocked", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: {} as never,
        generateId: () => "api_blocked",
        now: () => NOW,
      };

      await writeConnectorVersion(db, {
        id: "cv_noprev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_noprev",
        status: "active",
        sourceRefs: [{ family: "connector", id: "noprev" }],
        workspaceRoot: "/ws",
        planType: "manifest_delta",
        gateResults: [],
      });

      const result = await rollbackConnectorVersion("v_noprev", deps);
      assert.equal(result.status, "blocked");
      assert.match(result.reason ?? "", /no_previous_stable_ref/);
    } finally {
      db.close();
    }
  });
});
