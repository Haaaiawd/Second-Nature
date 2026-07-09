/**
 * v9 Connector Evolution activation integration test (T6.3.1).
 *
 * Verifies the full 7-gate orchestrator against a real in-memory SQLite state DB:
 * - All gates pass → version activates, ledger entry written, previous rolled_back.
 * - Schema gate fails → version blocked, no ledger.
 * - Canary fails → version rolled_back, previous restored, rollback ledger written.
 * - Rollback with no previous → blocked.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  readConnectorVersionById,
  readActiveConnectorVersion,
  readAutonomousChangeLedgerByTarget,
} from "../../../src/storage/v9-state-stores.js";
import {
  applyConnectorEvolution,
  rollbackConnectorVersion,
  createStateStoreVersionPort,
  createStateStoreLedgerPort,
  type ConnectorEvolutionEngineDeps,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.js";
import type { GateDeps } from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-gates.js";
import type {
  ConnectorEvolutionPlan,
  StageEvent,
  StageEventSink,
} from "../../../src/shared/types/v9-contracts.js";

const NOW = "2026-06-28T14:00:00Z";

function makePlan(overrides: Partial<ConnectorEvolutionPlan> = {}): ConnectorEvolutionPlan {
  return {
    id: "plan-int-1",
    platformId: "moltbook",
    planType: "manifest_delta",
    payloadJson: JSON.stringify({
      manifestPath: ".second-nature/connectors/moltbook/manifest.json",
      declaredCapabilities: ["moltbook:feed.read"],
    }),
    status: "proposed",
    sourceRefs: [{ family: "dream", id: "dream-int-1" }],
    createdAt: NOW,
    ...overrides,
  };
}

function makeGateDeps(overrides: Partial<GateDeps> = {}): GateDeps {
  return {
    getAllowedPlatformCapabilities: () => ["moltbook:feed.read", "moltbook:post.publish"],
    checkAdapterSandboxSafety: (path) => ({ safe: !path.includes("child_process") }),
    getFixtureData: (platformId) => (platformId === "moltbook" ? { sample: "feed" } : undefined),
    getWetProbeConfig: (platformId) =>
      platformId === "moltbook"
        ? { endpoint: "https://api.moltbook.io/feed", capability: "feed.read" }
        : undefined,
    getPreviousStableVersionId: (platformId) =>
      platformId === "moltbook" ? "v_moltbook_0" : undefined,
    checkCanaryHealth: () => ({ healthy: true }),
    ...overrides,
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

describe("INT-T6.3.1 connector evolution activation", () => {
  it("activates version when all gates pass and writes ledger", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: makeGateDeps(),
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      const result = await applyConnectorEvolution(makePlan(), "/workspace", deps);

      assert.equal(result.status, "active");
      assert.ok(result.version);
      assert.equal(result.version!.status, "active");
      assert.equal(result.gateResults.length, 7);

      // Version persisted in DB.
      const row = await readConnectorVersionById(db, result.version!.versionId);
      assert.ok(row);
      assert.equal(row!.status, "active");
      assert.ok(row!.activatedAt);
      assert.ok(row!.rollbackCommandHint);

      // Ledger entry persisted.
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, result.version!.versionId);
      assert.equal(ledgerRows.rows.length, 1);
      assert.equal(ledgerRows.rows[0].changeKind, "connector_manifest_delta");
      assert.equal(ledgerRows.rows[0].status, "activated");
    } finally {
      db.close();
    }
  });

  it("blocks on schema gate failure and writes no ledger", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: makeGateDeps(),
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      const plan = makePlan({
        payloadJson: JSON.stringify({ declaredCapabilities: ["moltbook:feed.read"] }),
      });
      const result = await applyConnectorEvolution(plan, "/workspace", deps);

      assert.equal(result.status, "blocked");
      assert.equal(result.gate, "schema");

      // Candidate version persisted.
      const row = await readConnectorVersionById(db, result.version!.versionId);
      assert.ok(row);
      assert.equal(row!.status, "candidate");

      // No ledger entry.
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, result.version!.versionId);
      assert.equal(ledgerRows.rows.length, 0);
    } finally {
      db.close();
    }
  });

  it("rolls back on canary failure and restores previous version", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const gates = makeGateDeps({
        checkCanaryHealth: () => ({ healthy: false, reason: "post_activation_timeout" }),
        getPreviousStableVersionId: () => "v_moltbook_prev",
      });
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates,
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      // Seed a previous active version.
      const { writeConnectorVersion } = await import("../../../src/storage/v9-state-stores.js");
      await writeConnectorVersion(db, {
        id: "cv_prev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_moltbook_prev",
        manifestPath: ".second-nature/connectors/moltbook/manifest.json",
        declaredCapabilities: ["moltbook:feed.read"],
        status: "active",
        sourceRefs: [{ family: "dream", id: "dream-prev" }],
        workspaceRoot: "/workspace",
        planType: "manifest_delta",
        gateResults: [],
      });

      const result = await applyConnectorEvolution(makePlan(), "/workspace", deps);

      assert.equal(result.status, "rolled_back");
      assert.ok(result.rollback);
      assert.equal(result.rollback!.status, "rolled_back");
      assert.equal(result.rollback!.restoredVersionId, "v_moltbook_prev");

      // New version is rolled_back in DB.
      const newRow = await readConnectorVersionById(db, result.version!.versionId);
      assert.equal(newRow!.status, "rolled_back");
      assert.ok(newRow!.rolledBackAt);

      // Previous version is active again.
      const prevRow = await readActiveConnectorVersion(db, "moltbook");
      assert.ok(prevRow);
      assert.equal(prevRow!.versionId, "v_moltbook_prev");

      // Two ledger entries: activation + rollback.
      const ledgerRows = await readAutonomousChangeLedgerByTarget(db, result.version!.versionId);
      assert.equal(ledgerRows.rows.length, 2);
      assert.equal(ledgerRows.rows[0].status, "activated");
      assert.equal(ledgerRows.rows[1].status, "rolled_back");
    } finally {
      db.close();
    }
  });

  it("direct rollback blocks when no previous stable", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const store = createStateStoreVersionPort(db);
      const ledger = createStateStoreLedgerPort(db);
      const obs = createMockObservability();
      const deps: ConnectorEvolutionEngineDeps = {
        store,
        ledger,
        observability: obs,
        gates: makeGateDeps(),
        generateId: () => `id_${Math.random().toString(36).slice(2, 10)}`,
        now: () => NOW,
      };

      const { writeConnectorVersion } = await import("../../../src/storage/v9-state-stores.js");
      await writeConnectorVersion(db, {
        id: "cv_noprev",
        createdAt: NOW,
        platformId: "moltbook",
        versionId: "v_noprev",
        status: "active",
        sourceRefs: [{ family: "dream", id: "dream-1" }],
        workspaceRoot: "/workspace",
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
