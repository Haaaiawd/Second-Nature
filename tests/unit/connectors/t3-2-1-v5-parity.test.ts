/**
 * Unit coverage for v5 connector parity fixtures (T3.2.1).
 *
 * Verifies that Moltbook, InStreet, and EvoMap v6 manifest fixtures
 * preserve capability sets, family, credential types, and trust semantics
 * from their v5 built-in connector definitions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { parseConnectorManifestV6 } from "../../../src/connectors/manifest/manifest-parser.js";
import { moltbookManifest } from "../../../src/connectors/social-community/moltbook/manifest.js";
import { instreetManifest } from "../../../src/connectors/social-community/instreet/manifest.js";
import { evomapManifest } from "../../../src/connectors/agent-network/evomap/manifest.js";

const projectRoot = process.cwd();
const fixturesDir = path.resolve(projectRoot, "tests/fixtures/connectors");

function loadFixture(platformId: string): string {
  return fs.readFileSync(
    path.join(fixturesDir, platformId, "manifest.yaml"),
    "utf-8",
  );
}

test("T3.2.1 Moltbook v6 manifest preserves v5 capabilities, family, and credentials", async () => {
  const yaml = loadFixture("moltbook");
  const result = parseConnectorManifestV6(yaml, "moltbook/manifest.yaml");
  assert.equal(result.ok, true);
  const manifest = result.manifest!;

  assert.equal(manifest.platformId, moltbookManifest.platformId);
  assert.equal(manifest.family, "social_community");

  const v6Caps = manifest.capabilities.map((c) => c.id).sort();
  const v5Caps = [...moltbookManifest.supportedCapabilities].sort();
  assert.deepEqual(v6Caps, v5Caps);

  const v6Creds = manifest.credentials.map((c) => c.type).sort();
  const v5Creds = [...moltbookManifest.credentialTypes].sort();
  assert.deepEqual(v6Creds, v5Creds);

  assert.equal(manifest.trust?.status, "declarative_trusted");
});

test("T3.2.1 InStreet v6 manifest preserves v5 capabilities, family, and credentials", async () => {
  const yaml = loadFixture("instreet");
  const result = parseConnectorManifestV6(yaml, "instreet/manifest.yaml");
  assert.equal(result.ok, true);
  const manifest = result.manifest!;

  assert.equal(manifest.platformId, instreetManifest.platformId);
  assert.equal(manifest.family, "social_community");

  const v6Caps = manifest.capabilities.map((c) => c.id).sort();
  const v5Caps = [...instreetManifest.supportedCapabilities].sort();
  assert.deepEqual(v6Caps, v5Caps);

  const v6Creds = manifest.credentials.map((c) => c.type).sort();
  const v5Creds = [...instreetManifest.credentialTypes].sort();
  assert.deepEqual(v6Creds, v5Creds);

  assert.equal(manifest.trust?.status, "declarative_trusted");
});

test("T3.2.1 EvoMap v6 manifest preserves v5 capabilities, family, and credentials", async () => {
  const yaml = loadFixture("evomap");
  const result = parseConnectorManifestV6(yaml, "evomap/manifest.yaml");
  assert.equal(result.ok, true);
  const manifest = result.manifest!;

  assert.equal(manifest.platformId, evomapManifest.platformId);
  assert.equal(manifest.family, "agent_network");

  const v6Caps = manifest.capabilities.map((c) => c.id).sort();
  const v5Caps = [...evomapManifest.supportedCapabilities].sort();
  assert.deepEqual(v6Caps, v5Caps);

  const v6Creds = manifest.credentials.map((c) => c.type).sort();
  const v5Creds = [...evomapManifest.credentialTypes].sort();
  assert.deepEqual(v6Creds, v5Creds);

  assert.equal(manifest.trust?.status, "declarative_trusted");
});

test("T3.2.1 All parity fixtures are declarative_trusted and executable under trust policy", async () => {
  const { classifyTrust, isExecutable } = await import(
    "../../../src/connectors/registry/trust-policy.js"
  );

  for (const platformId of ["moltbook", "instreet", "evomap"]) {
    const yaml = loadFixture(platformId);
    const result = parseConnectorManifestV6(yaml, `${platformId}/manifest.yaml`);
    assert.equal(result.ok, true);
    const manifest = result.manifest!;

    const trust = classifyTrust(manifest);
    assert.equal(trust, "declarative_trusted", `${platformId} trust mismatch`);
    assert.equal(isExecutable(trust), true, `${platformId} should be executable`);
  }
});

test("T3.2.1 Parity fixtures load successfully through DynamicConnectorRegistry reload", async () => {
  const {
    DynamicConnectorRegistry,
    createRegistrySnapshotStore,
  } = await import("../../../src/connectors/registry/index.js");

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-parity-"));
  const connectorsDir = path.join(tmpRoot, ".second-nature", "connectors");

  for (const platformId of ["moltbook", "instreet", "evomap"]) {
    const platformDir = path.join(connectorsDir, platformId);
    fs.mkdirSync(platformDir, { recursive: true });
    fs.copyFileSync(
      path.join(fixturesDir, platformId, "manifest.yaml"),
      path.join(platformDir, "manifest.yaml"),
    );
  }

  const store = createRegistrySnapshotStore();
  const registry = new DynamicConnectorRegistry({ snapshotStore: store });

  const reloadResult = registry.reloadConnectors(tmpRoot);

  assert.equal(reloadResult.scanned, 3);
  assert.equal(reloadResult.registered, 3);
  assert.equal(reloadResult.skipped, 0);

  const snapshot = registry.getActiveRegistrySnapshot();
  assert.equal(snapshot.entries.size, 3);

  for (const platformId of ["moltbook", "instreet", "evomap"]) {
    const entry = snapshot.entries.get(platformId);
    assert.ok(entry, `${platformId} must be in registry snapshot`);
    assert.equal(entry!.executable, true);
    assert.equal(entry!.source, "workspace");
  }

  fs.rmSync(tmpRoot, { recursive: true });
});
