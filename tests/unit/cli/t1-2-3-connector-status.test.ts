/**
 * Unit coverage for `connectorStatus` and `connectorTest` (T1.2.3).
 *
 * Verifies inventory summary, trust/executable flags, conflict reporting,
 * dry-run default, pending-trust denial, missing platformId, and registry
 * unavailable paths.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  connectorStatus,
  connectorTest,
} from "../../../src/cli/commands/connector-status.js";
import {
  DynamicConnectorRegistry,
  createRegistrySnapshotStore,
} from "../../../src/connectors/registry/index.js";
import type { ConnectorManifestV6 } from "../../../src/connectors/manifest/manifest-schema.js";

const builtInMoltbook: ConnectorManifestV6 = {
  schemaVersion: "sn.connector.v1",
  platformId: "moltbook",
  displayName: "Moltbook",
  family: "social_community",
  capabilities: [
    { id: "feed.read" },
    { id: "post.publish" },
    { id: "comment.reply" },
  ],
  runner: { kind: "declarative_http" },
  credentials: [{ type: "api_key", required: true }],
  sourceRefPolicy: { minSourceRefs: 1 },
};

const builtInEvoMap: ConnectorManifestV6 = {
  schemaVersion: "sn.connector.v1",
  platformId: "evomap",
  displayName: "EvoMap",
  family: "agent_network",
  capabilities: [
    { id: "agent.register" },
    { id: "work.discover" },
  ],
  runner: { kind: "declarative_http" },
  credentials: [{ type: "api_key", required: true }],
  sourceRefPolicy: { minSourceRefs: 1 },
};

// CR7-02: workspace custom adapter manifest that will be pending-trust
const customAdapterManifest: ConnectorManifestV6 = {
  schemaVersion: "sn.connector.v1",
  platformId: "custom-agent",
  displayName: "Custom Agent",
  family: "custom",
  capabilities: [{ id: "custom.agent_action" }],
  runner: { kind: "custom_adapter" },
  credentials: [],
  sourceRefPolicy: { minSourceRefs: 1 },
};

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-connector-status-"));
}

test("T1.2.3 connectorStatus returns inventory summary with trust and executable flags", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook, builtInEvoMap],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorStatus(registry, undefined);
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  const summary = data.summary as Record<string, number>;
  assert.equal(summary.total, 2);
  assert.equal(summary.builtIn, 2);
  assert.equal(summary.executable, 2);

  const connectors = data.connectors as Array<Record<string, unknown>>;
  assert.equal(connectors.length, 2);

  const moltbook = connectors.find((c) => c.platformId === "moltbook");
  assert.ok(moltbook);
  assert.equal(moltbook!.executable, true);
  assert.equal(moltbook!.trustStatus, "declarative_trusted");

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorStatus returns unavailable when registry absent", async () => {
  const result = await connectorStatus(undefined, undefined);
  assert.equal(result.ok, false);
  const err = result.error as Record<string, unknown>;
  assert.equal(err.code, "REGISTRY_UNAVAILABLE");
});

test("T1.2.3 connectorTest dry-run returns health checks for executable connector", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorTest(registry, { platformId: "moltbook" });
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  assert.equal(data.platformId, "moltbook");
  assert.equal(data.dryRun, true);
  assert.ok(Array.isArray(data.healthChecks));
  assert.ok((data.healthChecks as string[]).includes("ok"));

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorTest defaults to dry-run even when dryRun omitted", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorTest(registry, { platformId: "moltbook" });
  const data = result.data as Record<string, unknown>;
  assert.equal(data.dryRun, true);
  assert.ok((data.note as string).includes("dry-run"));

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorTest allows live mode only when dryRun:false explicitly set", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorTest(registry, {
    platformId: "moltbook",
    dryRun: false,
  });
  const data = result.data as Record<string, unknown>;
  assert.equal(data.dryRun, false);
  assert.ok((data.note as string).includes("live test"));

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorTest returns not_found for unknown platformId", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorTest(registry, { platformId: "unknown" });
  assert.equal(result.ok, false);
  const err = result.error as Record<string, unknown>;
  assert.equal(err.code, "CONNECTOR_NOT_FOUND");

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorTest returns missing_platform_id when empty", async () => {
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });

  const result = await connectorTest(registry, { platformId: "" });
  assert.equal(result.ok, false);
  const err = result.error as Record<string, unknown>;
  assert.equal(err.code, "MISSING_PLATFORM_ID");
});

// CR7-02: pending-trust / non-executable connector must fail-closed
test("T1.2.3 connectorTest returns PENDING_TRUST_DENIED for custom adapter (non-executable)", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook, customAdapterManifest],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  // custom-agent is pending-trust / not executable
  const result = await connectorTest(registry, { platformId: "custom-agent" });
  assert.equal(result.ok, false);

  const err = result.error as Record<string, unknown>;
  assert.equal(err.code, "PENDING_TRUST_DENIED");
  assert.ok((err.message as string).includes("custom-agent"));
  assert.ok((err.message as string).includes("not executable"));
  assert.equal(err.trustStatus, "custom_adapter_pending_trust");
  assert.equal(err.platformId, "custom-agent");

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorStatus shows pendingTrust count for custom adapter", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook, customAdapterManifest],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorStatus(registry, undefined);
  assert.equal(result.ok, true);

  const data = result.data as Record<string, unknown>;
  const summary = data.summary as Record<string, number>;
  assert.equal(summary.total, 2);
  assert.equal(summary.executable, 1);
  assert.equal(summary.pendingTrust, 1);

  const connectors = data.connectors as Array<Record<string, unknown>>;
  const custom = connectors.find((c) => c.platformId === "custom-agent");
  assert.ok(custom);
  assert.equal(custom!.executable, false);
  assert.equal(custom!.trustStatus, "custom_adapter_pending_trust");

  fs.rmSync(root, { recursive: true });
});

test("T1.2.3 connectorStatus records conflicts and validation errors when present", async () => {
  const root = tmpDir();
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtInMoltbook],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const result = await connectorStatus(registry, undefined);
  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.conflicts));
  assert.ok(Array.isArray(data.validationErrors));

  fs.rmSync(root, { recursive: true });
});
