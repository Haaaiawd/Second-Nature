/**
 * Unit coverage for `connectorInit` (T1.3.1).
 *
 * Verifies manifest generation, path safety, overwrite refusal,
 * force overwrite, platformId sanitization, and default values.
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

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sn-connector-init-"));
}

test("T1.3.1 creates manifest.yaml in .second-nature/connectors/{platformId}/", async () => {
  const root = tmpDir();
  const result = await connectorInit({
    platformId: "testplat",
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(result.platformId, "testplat");

  const manifestPath = path.join(root, ".second-nature", "connectors", "testplat", "manifest.yaml");
  assert.equal(result.manifestPath, manifestPath);
  assert.ok(fs.existsSync(manifestPath), "manifest.yaml must exist");

  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("schemaVersion: sn.connector.v1"));
  assert.ok(content.includes("platformId: testplat"));
  assert.ok(content.includes("family: custom"));
  assert.ok(content.includes("kind: declarative_http"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 skips overwrite by default", async () => {
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
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.skipped, true);
  assert.ok(second.reason?.includes("force"));

  fs.rmSync(root, { recursive: true });
});

test("T1.3.1 force:true overwrites existing manifest", async () => {
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
  assert.equal(result.skipped, undefined);

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

test("T1.3.1 uses custom family and runnerKind when provided", async () => {
  const root = tmpDir();
  const result = await connectorInit({
    platformId: "customplat",
    family: "social_community",
    runnerKind: "skill",
    displayName: "Custom Plat",
    workspaceRoot: root,
  });

  assert.equal(result.ok, true);
  const manifestPath = path.join(root, ".second-nature", "connectors", "customplat", "manifest.yaml");
  const content = fs.readFileSync(manifestPath, "utf-8");
  assert.ok(content.includes("family: social_community"));
  assert.ok(content.includes("kind: skill"));
  assert.ok(content.includes("displayName: Custom Plat"));

  fs.rmSync(root, { recursive: true });
});
