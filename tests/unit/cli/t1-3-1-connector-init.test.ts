/**
 * Unit coverage for `connectorInit` (T1.3.1).
 *
 * Verifies manifest + adapter.ts + types.ts generation, path safety,
 * overwrite refusal (fail-closed), force overwrite, platformId sanitization,
 * baseUrl propagation, and default values.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  connectorInit,
  type ConnectorInitResult,
} from "../../../src/cli/commands/connector-init.js";
import { connectorBehaviorAdd } from "../../../src/cli/commands/connector-behavior.js";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-connector-init-"));
}

test("T1.3.1 creates manifest.yaml + adapter.ts + types.ts in .second-nature/connectors/{platformId}/", async () => {
  const root = tmpDir();
  const result = await connectorInit({
    platformId: "testplat",
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(result.platformId, "testplat");

  const platformDir = path.join(root, ".second-nature", "connectors", "testplat");
  const manifestPath = path.join(platformDir, "manifest.yaml");
  const adapterPath = path.join(platformDir, "adapter.ts");
  const typesPath = path.join(platformDir, "types.ts");

  assert.equal(result.manifestPath, manifestPath);
  assert.equal(result.adapterPath, adapterPath);
  assert.equal(result.typesPath, typesPath);

  assert.ok(fs.existsSync(manifestPath), "manifest.yaml must exist");
  assert.ok(fs.existsSync(adapterPath), "adapter.ts must exist");
  assert.ok(fs.existsSync(typesPath), "types.ts must exist");

  const manifestContent = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(manifestContent.includes("schemaVersion: sn.connector.v1"));
  assert.ok(manifestContent.includes("platformId: testplat"));
  assert.ok(manifestContent.includes("family: custom"));
  assert.ok(manifestContent.includes("kind: declarative_http"));

  const adapterContent = fs.readFileSync(adapterPath, "utf-8");
  assert.ok(adapterContent.includes("Testplat Connector Adapter Stub"));
  assert.ok(adapterContent.includes("interface TestplatAdapterConfig"));
  assert.ok(adapterContent.includes("executeTestplatAction"));

  const typesContent = fs.readFileSync(typesPath, "utf-8");
  assert.ok(typesContent.includes("interface TestplatCapability"));
  assert.ok(typesContent.includes("interface TestplatCredential"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 returns fail-closed when manifest already exists without force", async () => {
  const root = tmpDir();
  const first = await connectorInit({
    platformId: "dupe",
    workspaceRoot: root,
  });
  assert.equal(first.created, true);

  const second = await connectorInit({
    platformId: "dupe",
    workspaceRoot: root,
  });
  // CR7-01: existing target must return ok:false (not ok:true skipped)
  assert.equal(second.ok, false);
  assert.equal(second.created, false);
  assert.ok(second.reason?.includes("force"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 force:true overwrites existing manifest and stubs", async () => {
  const root = tmpDir();
  await connectorInit({
    platformId: "forceme",
    workspaceRoot: root,
  });

  const result = await connectorInit({
    platformId: "forceme",
    workspaceRoot: root,
    force: true,
    displayName: "Forced Display",
  });
  assert.equal(result.ok, true);
  assert.equal(result.created, true);

  const manifestPath = path.join(root, ".second-nature", "connectors", "forceme", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("displayName: Forced Display"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 rejects empty platformId", async () => {
  const result = await connectorInit({ platformId: "" });
  assert.equal(result.ok, false);
  assert.ok(result.reason?.includes("platformId"));
});

test("T1.3.1 rejects platformId with invalid characters", async () => {
  const result = await connectorInit({ platformId: "my/platform" });
  assert.equal(result.ok, false);
  assert.ok(result.reason?.includes("invalid characters"));
});

test("T1.3.1 rejects dot and dot-dot platformId (path escape guard)", async () => {
  const dot = await connectorInit({ platformId: "." });
  assert.equal(dot.ok, false);
  assert.ok(dot.reason?.includes("cannot be"));

  const dotdot = await connectorInit({ platformId: ".." });
  assert.equal(dotdot.ok, false);
  assert.ok(dotdot.reason?.includes("cannot be"));
});

test("T1.3.1 uses custom family, runnerKind, and baseUrl when provided", async () => {
  const root = tmpDir();
  const result = await connectorInit({
    platformId: "customplat",
    family: "social_community",
    runnerKind: "skill",
    displayName: "Custom Plat",
    baseUrl: "https://example.com/api",
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  const manifestPath = path.join(root, ".second-nature", "connectors", "customplat", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("family: social_community"));
  assert.ok(content.includes("kind: skill"));
  assert.ok(content.includes("displayName: Custom Plat"));
  assert.ok(content.includes("baseUrl: https://example.com/api"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 generated manifest has custom_adapter_pending_trust and executable=false after scan", async () => {
  const root = tmpDir();
  await connectorInit({
    platformId: "agent-world",
    runnerKind: "custom_adapter",
    workspaceRoot: root,
  });

  const manifestPath = path.join(root, ".second-nature", "connectors", "agent-world", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("status: custom_adapter_pending_trust"));
  assert.ok(content.includes("reason: generated_by_connector_init"));

  fs.rmSync(root, { recursive: true });
});

test("connector_behavior_add appends a custom behavior to an existing manifest", async () => {
  const root = tmpDir();
  await connectorInit({
    platformId: "github",
    workspaceRoot: root,
  });

  const result = await connectorBehaviorAdd({
    platformId: "github",
    behaviorId: "issue.search",
    description: "Search issues before deciding whether to comment",
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  assert.equal(result.added, true);

  const manifestPath = path.join(root, ".second-nature", "connectors", "github", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("id: issue.search"));
  assert.ok(content.includes("Search issues before deciding whether to comment"));

  const second = await connectorBehaviorAdd({
    platformId: "github",
    behaviorId: "issue.search",
    workspaceRoot: root,
  });
  assert.equal(second.ok, true);
  assert.equal(second.added, false);

  fs.rmSync(root, { recursive: true });
});

test("connector_behavior_add requires a reviewable motive for new behaviors", async () => {
  const root = tmpDir();
  await connectorInit({
    platformId: "github",
    workspaceRoot: root,
  });

  const result = await connectorBehaviorAdd({
    platformId: "github",
    behaviorId: "issue.search",
    workspaceRoot: root,
  });

  assert.equal(result.ok, false);
  assert.equal(result.added, false);
  assert.match(result.reason ?? "", /description or sourceRefs is required/);

  fs.rmSync(root, { recursive: true });
});

test("connector_behavior_add records source refs and observed count", async () => {
  const root = tmpDir();
  await connectorInit({
    platformId: "github",
    workspaceRoot: root,
  });

  const result = await connectorBehaviorAdd({
    platformId: "github",
    behaviorId: "issue.search",
    sourceRefs: ["quiet:proposal:github-issue-search"],
    observedCount: 2,
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  const manifestPath = path.join(root, ".second-nature", "connectors", "github", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("sourceRefs:"));
  assert.ok(content.includes("quiet:proposal:github-issue-search"));
  assert.ok(content.includes("observedCount: 2"));

  fs.rmSync(root, { recursive: true });
});

test("connector_behavior_add rejects unsafe platform ids", async () => {
  const root = tmpDir();

  const result = await connectorBehaviorAdd({
    platformId: "..",
    behaviorId: "issue.search",
    workspaceRoot: root,
  });

  assert.equal(result.ok, false);
  assert.equal(result.added, false);
  assert.match(result.reason ?? "", /platformId is required/);

  fs.rmSync(root, { recursive: true });
});
