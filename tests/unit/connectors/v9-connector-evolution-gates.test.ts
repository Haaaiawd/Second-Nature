/**
 * v9 Connector Evolution Gates — Unit Tests (T6.3.1)
 *
 * Validates each of the 7 gates independently:
 * - schema: valid/invalid payload structure
 * - permission: capability scope enforcement
 * - sandbox: forbidden module detection
 * - fixture: fixture data availability
 * - wet_probe: probe config availability
 * - rollback_setup: previous stable ref resolution
 * - canary: post-activation health check
 *
 * Also validates the full applyConnectorEvolution orchestrator flow:
 * - all gates pass → active
 * - pre-activation gate fail → blocked
 * - canary fail → rolled_back
 * - rollback with no previous → blocked
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runSchemaGate,
  runPermissionGate,
  runSandboxGate,
  runFixtureGate,
  runWetProbeGate,
  runRollbackSetupGate,
  runCanaryGate,
  parseProposedChanges,
  type GateDeps,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-gates.js";
import {
  applyConnectorEvolution,
  rollbackConnectorVersion,
  deriveTargetVersion,
  buildRollbackCommandHint,
  type ConnectorEvolutionEngineDeps,
  type ConnectorVersionStorePort,
  type LedgerWritePort,
} from "../../../src/core/second-nature/body/connector-evolution/v9-connector-evolution-engine.js";
import type {
  ConnectorEvolutionPlan,
  ConnectorVersion,
  StageEvent,
  StageEventSink,
  SourceRef,
} from "../../../src/shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────

const NOW = "2026-06-28T14:00:00Z";

function makePlan(overrides: Partial<ConnectorEvolutionPlan> = {}): ConnectorEvolutionPlan {
  return {
    id: "plan-1",
    platformId: "moltbook",
    planType: "manifest_delta",
    payloadJson: JSON.stringify({
      manifestPath: ".second-nature/connectors/moltbook/manifest.json",
      declaredCapabilities: ["moltbook:feed.read"],
    }),
    status: "proposed",
    sourceRefs: [{ family: "dream", id: "dream-1" }],
    createdAt: NOW,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<ConnectorVersion> = {}): ConnectorVersion {
  return {
    id: "cv-1",
    versionId: "v_moltbook_1",
    platformId: "moltbook",
    workspaceRoot: "/workspace",
    planType: "manifest_delta",
    manifestPath: ".second-nature/connectors/moltbook/manifest.json",
    declaredCapabilities: ["moltbook:feed.read"],
    gateResults: [],
    status: "candidate",
    sourceRefs: [{ family: "dream", id: "dream-1" }],
    createdAt: NOW,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<GateDeps> = {}): GateDeps {
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

// ───────────────────────────────────────────────────────────────
// parseProposedChanges
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 parseProposedChanges", () => {
  it("parses valid payload with manifestPath and capabilities", () => {
    const plan = makePlan();
    const changes = parseProposedChanges(plan);
    assert.ok(changes.manifestPath);
    assert.deepEqual(changes.declaredCapabilities, ["moltbook:feed.read"]);
  });

  it("returns empty object for missing payloadJson", () => {
    const plan = makePlan({ payloadJson: "" });
    const changes = parseProposedChanges(plan);
    assert.deepEqual(changes, {});
  });

  it("returns empty object for malformed json", () => {
    const plan = makePlan({ payloadJson: "{not json" });
    const changes = parseProposedChanges(plan);
    assert.deepEqual(changes, {});
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 1: schema
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 schema gate", () => {
  it("passes with valid manifestPath and capabilities array", async () => {
    const result = await runSchemaGate(makeVersion(), makePlan(), makeDeps());
    assert.ok(result.passed);
    assert.equal(result.gate, "schema");
  });

  it("fails when manifestPath is missing", async () => {
    const plan = makePlan({
      payloadJson: JSON.stringify({ declaredCapabilities: ["moltbook:feed.read"] }),
    });
    const result = await runSchemaGate(makeVersion(), plan, makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /manifestPath_missing/);
  });

  it("fails when declaredCapabilities is not an array", async () => {
    const plan = makePlan({
      payloadJson: JSON.stringify({
        manifestPath: "manifest.json",
        declaredCapabilities: "not-an-array",
      }),
    });
    const result = await runSchemaGate(makeVersion(), plan, makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /declaredCapabilities_not_array/);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 2: permission
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 permission gate", () => {
  it("passes when capabilities are within platform scope", async () => {
    const result = await runPermissionGate(makeVersion(), makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("fails when capabilities exceed platform scope", async () => {
    const version = makeVersion({ declaredCapabilities: ["moltbook:feed.read", "instreet:work.discover"] });
    const result = await runPermissionGate(version, makePlan(), makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /capabilities_exceed_platform_scope/);
  });

  it("passes with no declared capabilities", async () => {
    const version = makeVersion({ declaredCapabilities: [] });
    const result = await runPermissionGate(version, makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("uses structural fallback when no allowed-capabilities provider", async () => {
    const version = makeVersion({ declaredCapabilities: ["moltbook:feed.read"] });
    const deps = makeDeps({ getAllowedPlatformCapabilities: undefined });
    const result = await runPermissionGate(version, makePlan(), deps);
    assert.ok(result.passed);
  });

  it("structural fallback fails for misaligned capability", async () => {
    const version = makeVersion({ declaredCapabilities: ["instreet:work.discover"] });
    const deps = makeDeps({ getAllowedPlatformCapabilities: undefined });
    const result = await runPermissionGate(version, makePlan(), deps);
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /capabilities_not_platform_scoped/);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 3: sandbox
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 sandbox gate", () => {
  it("passes for manifest-only delta (no adapterPath)", async () => {
    const version = makeVersion({ adapterPath: undefined });
    const result = await runSandboxGate(version, makePlan(), makeDeps());
    assert.ok(result.passed);
    assert.match(result.reason ?? "", /manifest_only/);
  });

  it("passes for safe adapter path", async () => {
    const version = makeVersion({ adapterPath: ".second-nature/connectors/moltbook/adapter.js" });
    const result = await runSandboxGate(version, makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("fails for adapter with child_process reference", async () => {
    const version = makeVersion({ adapterPath: "adapter_with_child_process.js" });
    const result = await runSandboxGate(version, makePlan(), makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /adapter_sandbox_violation/);
  });

  it("structural fallback detects forbidden module patterns in path", async () => {
    // T6.3.1 structural fallback checks the adapterPath string itself;
    // file content scanning is T6.3.2's job. "vm2" is a forbidden module
    // that can appear in a path component name.
    const version = makeVersion({ adapterPath: "adapters/vm2/adapter.js" });
    const deps = makeDeps({ checkAdapterSandboxSafety: undefined });
    const result = await runSandboxGate(version, makePlan(), deps);
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /forbidden_module_reference/);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 4: fixture
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 fixture gate", () => {
  it("passes when fixture data exists", async () => {
    const result = await runFixtureGate(makeVersion(), makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("fails when no fixture data for platform", async () => {
    const plan = makePlan({ platformId: "unknown_platform" });
    const result = await runFixtureGate(makeVersion({ platformId: "unknown_platform" }), plan, makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /no_fixture_data/);
  });

  it("structural pass when no fixture provider", async () => {
    const deps = makeDeps({ getFixtureData: undefined });
    const result = await runFixtureGate(makeVersion(), makePlan(), deps);
    assert.ok(result.passed);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 5: wet_probe
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 wet_probe gate", () => {
  it("passes when probe config exists", async () => {
    const result = await runWetProbeGate(makeVersion(), makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("fails when no probe config for platform", async () => {
    const plan = makePlan({ platformId: "unknown_platform" });
    const result = await runWetProbeGate(makeVersion({ platformId: "unknown_platform" }), plan, makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /no_wet_probe_config/);
  });

  it("structural pass when no probe provider", async () => {
    const deps = makeDeps({ getWetProbeConfig: undefined });
    const result = await runWetProbeGate(makeVersion(), makePlan(), deps);
    assert.ok(result.passed);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 6: rollback_setup
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 rollback_setup gate", () => {
  it("passes with resolvable previousStableRef", async () => {
    const version = makeVersion({ previousStableRef: "v_moltbook_0" });
    const result = await runRollbackSetupGate(version, makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("passes with no previous stable (hint required)", async () => {
    const version = makeVersion({ previousStableRef: undefined });
    const result = await runRollbackSetupGate(version, makePlan(), makeDeps());
    assert.ok(result.passed);
    assert.match(result.reason ?? "", /no_previous_stable/);
  });

  it("fails when previousStableRef not resolvable", async () => {
    const version = makeVersion({ previousStableRef: "v_nonexistent" });
    const result = await runRollbackSetupGate(version, makePlan(), makeDeps());
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /previous_stable_ref_not_resolvable/);
  });
});

// ───────────────────────────────────────────────────────────────
// Gate 7: canary
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 canary gate", () => {
  it("passes when health check is healthy", async () => {
    const result = await runCanaryGate(makeVersion(), makePlan(), makeDeps());
    assert.ok(result.passed);
  });

  it("fails when health check is unhealthy", async () => {
    const deps = makeDeps({ checkCanaryHealth: () => ({ healthy: false, reason: "endpoint_timeout" }) });
    const result = await runCanaryGate(makeVersion(), makePlan(), deps);
    assert.ok(!result.passed);
    assert.match(result.reason ?? "", /endpoint_timeout/);
  });

  it("structural pass when no health checker", async () => {
    const deps = makeDeps({ checkCanaryHealth: undefined });
    const result = await runCanaryGate(makeVersion(), makePlan(), deps);
    assert.ok(result.passed);
  });
});

// ───────────────────────────────────────────────────────────────
// buildRollbackCommandHint
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 buildRollbackCommandHint", () => {
  it("generates full rollback command with previous version", () => {
    const hint = buildRollbackCommandHint("moltbook", "v1", "v0");
    assert.match(hint, /connector_evolution\.rollback.*from=v1.*to=v0/);
  });

  it("generates no-previous-stable hint", () => {
    const hint = buildRollbackCommandHint("moltbook", "v1", undefined);
    assert.match(hint, /no previous stable/);
  });
});

// ───────────────────────────────────────────────────────────────
// deriveTargetVersion
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 deriveTargetVersion", () => {
  it("derives version from plan payload", () => {
    const plan = makePlan();
    const version = deriveTargetVersion(plan, "/workspace", () => "cv_123", () => NOW);
    assert.equal(version.platformId, "moltbook");
    assert.equal(version.manifestPath, ".second-nature/connectors/moltbook/manifest.json");
    assert.deepEqual(version.declaredCapabilities, ["moltbook:feed.read"]);
    assert.equal(version.status, "candidate");
    assert.equal(version.workspaceRoot, "/workspace");
  });
});

// ───────────────────────────────────────────────────────────────
// applyConnectorEvolution orchestrator (mock ports)
// ───────────────────────────────────────────────────────────────

function createMockStore(): ConnectorVersionStorePort & {
  versions: Map<string, ConnectorVersion>;
} {
  const versions = new Map<string, ConnectorVersion>();
  return {
    versions,
    async writeVersion(version: ConnectorVersion) {
      versions.set(version.versionId, version);
    },
    async readVersionById(versionId: string) {
      return versions.get(versionId);
    },
    async readActiveVersion(platformId: string) {
      return [...versions.values()].find(
        (v) => v.platformId === platformId && v.status === "active",
      );
    },
    async updateVersionStatus(versionId, status, patch) {
      const v = versions.get(versionId);
      if (!v) return undefined;
      const updated: ConnectorVersion = {
        ...v,
        status,
        activatedAt: patch?.activatedAt ?? v.activatedAt,
        rolledBackAt: patch?.rolledBackAt ?? v.rolledBackAt,
        rollbackRef: patch?.rollbackRef ?? v.rollbackRef,
        rollbackCommandHint: patch?.rollbackCommandHint ?? v.rollbackCommandHint,
      };
      versions.set(versionId, updated);
      return updated;
    },
  };
}

function createMockLedger(): LedgerWritePort & {
  entries: { id: string; changeKind: string; status: string; targetId: string }[];
} {
  const entries: { id: string; changeKind: string; status: string; targetId: string }[] = [];
  return {
    entries,
    async writeLedgerEntry(entry) {
      entries.push({
        id: entry.id,
        changeKind: entry.changeKind,
        status: entry.status ?? "proposed",
        targetId: entry.targetId,
      });
      return { id: entry.id };
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

function createMockEngineDeps(
  store: ConnectorVersionStorePort,
  ledger: LedgerWritePort,
  observability: StageEventSink,
  gates: GateDeps,
): ConnectorEvolutionEngineDeps {
  return {
    store,
    ledger,
    observability,
    gates,
    generateId: () => `mock_${Math.random().toString(36).slice(2, 10)}`,
    now: () => NOW,
  };
}

describe("T6.3.1 applyConnectorEvolution orchestrator", () => {
  it("activates version when all gates pass", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const result = await applyConnectorEvolution(makePlan(), "/workspace", deps);

    assert.equal(result.status, "active");
    assert.ok(result.version);
    assert.equal(result.version!.status, "active");
    assert.ok(result.version!.activatedAt);
    assert.ok(result.version!.rollbackCommandHint);
    assert.equal(result.gateResults.length, 7); // 6 pre-activation + 1 canary

    // Ledger entry written with activated status.
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].status, "activated");
    assert.equal(ledger.entries[0].changeKind, "connector_manifest_delta");

    // Activated stage event emitted.
    const activatedEvent = obs.events.find((e) => e.outcome === "activated");
    assert.ok(activatedEvent);
    assert.equal(activatedEvent!.reasonCode, "evolution_activated");
  });

  it("blocks when schema gate fails (missing manifestPath)", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const plan = makePlan({
      payloadJson: JSON.stringify({ declaredCapabilities: ["moltbook:feed.read"] }),
    });
    const result = await applyConnectorEvolution(plan, "/workspace", deps);

    assert.equal(result.status, "blocked");
    assert.equal(result.gate, "schema");
    assert.equal(result.version!.status, "candidate");
    assert.equal(ledger.entries.length, 0); // no ledger on block

    const blockedEvent = obs.events.find((e) => e.outcome === "blocked");
    assert.ok(blockedEvent);
    assert.match(blockedEvent!.reasonCode, /evolution_gate_schema_failed/);
  });

  it("blocks when permission gate fails (capability expansion)", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const plan = makePlan({
      payloadJson: JSON.stringify({
        manifestPath: "manifest.json",
        declaredCapabilities: ["instreet:work.discover"],
      }),
    });
    const result = await applyConnectorEvolution(plan, "/workspace", deps);

    assert.equal(result.status, "blocked");
    assert.equal(result.gate, "permission");
  });

  it("rolls back when canary fails", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const gates = makeDeps({
      checkCanaryHealth: () => ({ healthy: false, reason: "post_activation_timeout" }),
    });
    const deps = createMockEngineDeps(store, ledger, obs, gates);

    // Seed a previous active version for rollback target.
    const previousVersion = makeVersion({
      versionId: "v_moltbook_0",
      status: "active",
      previousStableRef: undefined,
    });
    await store.writeVersion(previousVersion);

    const result = await applyConnectorEvolution(makePlan(), "/workspace", deps);

    assert.equal(result.status, "rolled_back");
    assert.ok(result.rollback);
    assert.equal(result.rollback!.status, "rolled_back");
    assert.equal(result.rollback!.restoredVersionId, "v_moltbook_0");

    // Two ledger entries: activation + rollback.
    assert.equal(ledger.entries.length, 2);
    assert.equal(ledger.entries[0].status, "activated");
    assert.equal(ledger.entries[1].status, "rolled_back");

    // Rollback events emitted.
    const rollbackEvents = obs.events.filter((e) => e.stage === "rollback");
    assert.ok(rollbackEvents.length >= 2);
  });

  it("blocks rollback when no previous stable exists", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const gates = makeDeps({
      checkCanaryHealth: () => ({ healthy: false, reason: "fail" }),
      getPreviousStableVersionId: () => undefined,
    });
    const deps = createMockEngineDeps(store, ledger, obs, gates);

    // No previous active version seeded.
    const result = await applyConnectorEvolution(
      makePlan({ previousStableRef: undefined }),
      "/workspace",
      deps,
    );

    // Canary fails but rollback can't find previous → blocked.
    assert.equal(result.status, "blocked");
    assert.ok(result.rollback);
    assert.equal(result.rollback!.status, "blocked");
  });
});

// ───────────────────────────────────────────────────────────────
// rollbackConnectorVersion
// ───────────────────────────────────────────────────────────────

describe("T6.3.1 rollbackConnectorVersion", () => {
  it("rolls back to previous stable version", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const previous = makeVersion({ versionId: "v_old", status: "active" });
    const current = makeVersion({
      versionId: "v_new",
      status: "active",
      previousStableRef: "v_old",
    });
    await store.writeVersion(previous);
    await store.writeVersion(current);

    const result = await rollbackConnectorVersion("v_new", deps);

    assert.equal(result.status, "rolled_back");
    assert.equal(result.restoredVersionId, "v_old");

    // Current is rolled_back, previous is active.
    const currentRow = await store.readVersionById("v_new");
    assert.equal(currentRow!.status, "rolled_back");
    const previousRow = await store.readVersionById("v_old");
    assert.equal(previousRow!.status, "active");

    // Ledger entry written.
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].status, "rolled_back");
  });

  it("blocks when no previous stable ref", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const current = makeVersion({ versionId: "v_new", previousStableRef: undefined });
    await store.writeVersion(current);

    const result = await rollbackConnectorVersion("v_new", deps);
    assert.equal(result.status, "blocked");
    assert.match(result.reason ?? "", /no_previous_stable_ref/);
  });

  it("blocks when previous version missing", async () => {
    const store = createMockStore();
    const ledger = createMockLedger();
    const obs = createMockObservability();
    const deps = createMockEngineDeps(store, ledger, obs, makeDeps());

    const current = makeVersion({ versionId: "v_new", previousStableRef: "v_nonexistent" });
    await store.writeVersion(current);

    const result = await rollbackConnectorVersion("v_new", deps);
    assert.equal(result.status, "blocked");
    assert.match(result.reason ?? "", /previous_version_missing/);
  });
});
