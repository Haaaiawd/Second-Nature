import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import yaml from "js-yaml";

import {
  DynamicConnectorRegistry,
  createRegistrySnapshotStore,
} from "../../../src/connectors/registry/dynamic-connector-registry.js";
import { scanConnectorManifests } from "../../../src/connectors/registry/manifest-scanner.js";
import { parseConnectorManifestV6 } from "../../../src/connectors/manifest/manifest-parser.js";
import { classifyTrust, isExecutable } from "../../../src/connectors/registry/trust-policy.js";
import type { ConnectorManifestV6 } from "../../../src/connectors/manifest/manifest-schema.js";

function makeManifest(overrides: Partial<ConnectorManifestV6> = {}): ConnectorManifestV6 {
  return {
    schemaVersion: "sn.connector.v1",
    platformId: "test-platform",
    displayName: "Test Platform",
    family: "social_community",
    capabilities: [{ id: "feed.read" }],
    runner: { kind: "declarative_http" },
    credentials: [{ type: "api_key", required: true }],
    sourceRefPolicy: { minSourceRefs: 1 },
    ...overrides,
  };
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-connector-test-"));
}

function writeManifest(root: string, platformId: string, manifest: ConnectorManifestV6): void {
  const dir = path.join(root, ".second-nature", "connectors", platformId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.yaml"), yaml.dump(manifest));
}

test("parseConnectorManifestV6 accepts valid manifest", () => {
  const manifest = makeManifest();
  const result = parseConnectorManifestV6(yaml.dump(manifest));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.platformId, "test-platform");
  assert.equal(result.manifest.runner.kind, "declarative_http");
});

test("parseConnectorManifestV6 rejects invalid schema", () => {
  const result = parseConnectorManifestV6("not_yaml{{{");
  assert.equal(result.ok, false);
});

test("parseConnectorManifestV6 rejects missing required fields", () => {
  const result = parseConnectorManifestV6("platformId: only-this");
  assert.equal(result.ok, false);
});

test("classifyTrust declarative_http -> declarative_trusted", () => {
  const status = classifyTrust(makeManifest({ runner: { kind: "declarative_http" } }));
  assert.equal(status, "declarative_trusted");
});

test("classifyTrust custom_adapter -> custom_adapter_pending_trust", () => {
  const status = classifyTrust(makeManifest({ runner: { kind: "custom_adapter" } }));
  assert.equal(status, "custom_adapter_pending_trust");
});

test("classifyTrust respects manifest.trust.status blocked", () => {
  const status = classifyTrust(
    makeManifest({ runner: { kind: "declarative_http" }, trust: { status: "blocked" } }),
  );
  assert.equal(status, "blocked");
});

test("isExecutable declarative_trusted -> true", () => {
  assert.equal(isExecutable("declarative_trusted"), true);
});

test("isExecutable custom_adapter_pending_trust -> false", () => {
  assert.equal(isExecutable("custom_adapter_pending_trust"), false);
});

test("scanConnectorManifests returns empty when no connectors dir", () => {
  const root = tempDir();
  const results = scanConnectorManifests(root);
  assert.equal(results.length, 0);
});

test("scanConnectorManifests enumerates manifest.yaml files", () => {
  const root = tempDir();
  writeManifest(root, "platform-a", makeManifest({ platformId: "platform-a" }));
  writeManifest(root, "platform-b", makeManifest({ platformId: "platform-b" }));
  const results = scanConnectorManifests(root);
  assert.equal(results.length, 2);
  assert.ok(results.some((r) => r.path.includes("platform-a")));
  assert.ok(results.some((r) => r.path.includes("platform-b")));
});

test("DynamicConnectorRegistry reload registers valid manifest", () => {
  const root = tempDir();
  writeManifest(root, "moltbook", makeManifest({ platformId: "moltbook", displayName: "Moltbook" }));

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  const result = registry.reloadConnectors(root);

  assert.equal(result.scanned, 1);
  assert.equal(result.registered, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.validationErrors.length, 0);

  const entry = registry.describeConnector("moltbook");
  assert.ok(entry);
  assert.equal(entry!.trustStatus, "declarative_trusted");
  assert.equal(entry!.executable, true);
});

test("DynamicConnectorRegistry reload skips invalid manifest and records validation error", () => {
  const root = tempDir();
  const dir = path.join(root, ".second-nature", "connectors", "bad-platform");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.yaml"), "invalid: yaml: [[");

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  const result = registry.reloadConnectors(root);

  assert.equal(result.scanned, 1);
  assert.equal(result.registered, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.validationErrors.length, 1);
  assert.equal(registry.describeConnector("bad-platform"), undefined);
});

test("DynamicConnectorRegistry custom adapter is pending trust and not executable", () => {
  const root = tempDir();
  writeManifest(
    root,
    "custom-plat",
    makeManifest({ platformId: "custom-plat", runner: { kind: "custom_adapter", entrypoint: "./adapter.ts" } }),
  );

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  registry.reloadConnectors(root);

  const entry = registry.describeConnector("custom-plat");
  assert.ok(entry);
  assert.equal(entry!.trustStatus, "custom_adapter_pending_trust");
  assert.equal(entry!.executable, false);
});

test("DynamicConnectorRegistry fail-closed conflict on duplicate platformId", () => {
  const root = tempDir();
  writeManifest(root, "dup", makeManifest({ platformId: "dup", displayName: "First" }));

  // Second manifest with same platformId in a different dir
  const dir2 = path.join(root, ".second-nature", "connectors", "dup-alt");
  fs.mkdirSync(dir2, { recursive: true });
  fs.writeFileSync(
    path.join(dir2, "manifest.yaml"),
    yaml.dump(makeManifest({ platformId: "dup", displayName: "Second" })),
  );

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  const result = registry.reloadConnectors(root);

  assert.equal(result.scanned, 2);
  assert.equal(result.registered, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]!.platformId, "dup");

  const entry = registry.describeConnector("dup");
  assert.ok(entry);
  assert.ok(entry!);
});

test("DynamicConnectorRegistry built-in + dynamic merge", () => {
  const root = tempDir();
  writeManifest(root, "ws-plat", makeManifest({ platformId: "ws-plat" }));

  const builtIn = makeManifest({ platformId: "builtin-plat", displayName: "Built-in" });
  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({
    builtInManifests: [builtIn],
    snapshotStore: store,
  });
  registry.reloadConnectors(root);

  const snapshot = registry.getActiveRegistrySnapshot();
  assert.equal(snapshot.entries.size, 2);
  assert.equal(snapshot.builtInEntries.size, 1);
  assert.equal(snapshot.dynamicEntries.size, 1);
  assert.ok(snapshot.entries.has("builtin-plat"));
  assert.ok(snapshot.entries.has("ws-plat"));
});

test("DynamicConnectorRegistry snapshot is immutable", () => {
  const root = tempDir();
  writeManifest(root, "plat", makeManifest({ platformId: "plat" }));

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  registry.reloadConnectors(root);

  const snapshot = registry.getActiveRegistrySnapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.conflicts), true);
  assert.equal(Object.isFrozen(snapshot.validationErrors), true);
});

test("DynamicConnectorRegistry listConnectors returns all entries", () => {
  const root = tempDir();
  writeManifest(root, "a", makeManifest({ platformId: "a" }));
  writeManifest(root, "b", makeManifest({ platformId: "b" }));

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });
  registry.reloadConnectors(root);

  const list = registry.listConnectors();
  assert.equal(list.length, 2);
});
