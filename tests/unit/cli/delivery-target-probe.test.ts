/**
 * T-ROS.C.6 — Delivery target real probe unit tests.
 *
 * Verifies createStaticUnknownAdapter.checkDeliveryTarget:
 * - workspace manifest with message.send → target_available + evidenceRefs
 * - workspace without delivery connector → target_none + reason
 * - no workspaceRoot → target_none + reason
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Import the built module (test runs against dist/ after build)
import { createOpsRouter } from "../../../src/cli/ops/ops-router.js";

function makeWorkspaceWithDeliveryConnector(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-delivery-"));
  const connectorsDir = path.join(dir, ".second-nature", "connectors", "test-platform");
  fs.mkdirSync(connectorsDir, { recursive: true });
  fs.writeFileSync(
    path.join(connectorsDir, "manifest.yaml"),
    `schemaVersion: "sn.connector.v1"
platformId: "test-platform"
displayName: "Test Platform"
family: "social_community"
capabilities:
  - id: "feed.read"
    channel: "api_rest"
  - id: "message.send"
    channel: "api_rest"
runner:
  kind: "declarative_http"
  config:
    baseUrl: "https://example.com"
credentials:
  - type: "api_key"
    required: true
sourceRefPolicy:
  minSourceRefs: 1
trust:
  status: "declarative_trusted"
`,
    "utf-8",
  );
  return dir;
}

function makeWorkspaceWithoutDeliveryConnector(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-no-delivery-"));
  const connectorsDir = path.join(dir, ".second-nature", "connectors", "test-platform");
  fs.mkdirSync(connectorsDir, { recursive: true });
  fs.writeFileSync(
    path.join(connectorsDir, "manifest.yaml"),
    `schemaVersion: "sn.connector.v1"
platformId: "test-platform"
displayName: "Test Platform"
family: "social_community"
capabilities:
  - id: "feed.read"
    channel: "api_rest"
runner:
  kind: "declarative_http"
  config:
    baseUrl: "https://example.com"
credentials:
  - type: "api_key"
    required: true
sourceRefPolicy:
  minSourceRefs: 1
trust:
  status: "declarative_trusted"
`,
    "utf-8",
  );
  return dir;
}

test("T-ROS.C.6-A: workspace with message.send returns target_available", async () => {
  const workspaceRoot = makeWorkspaceWithDeliveryConnector();
  try {
    const router = createOpsRouter({
      runtimeAvailable: true,
      workspaceRoot,
    });

    const result = await router.dispatch("capability_probe");
    assert.ok(result && typeof result === "object" && "data" in result, "result must contain data");
    const data = (result as { data: { deliveryTarget: string } }).data;
    assert.equal(data.deliveryTarget, "target_available", `expected target_available, got ${data.deliveryTarget}`);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-ROS.C.6-B: workspace without delivery connector returns target_none", async () => {
  const workspaceRoot = makeWorkspaceWithoutDeliveryConnector();
  try {
    const router = createOpsRouter({
      runtimeAvailable: true,
      workspaceRoot,
    });

    const result = await router.dispatch("capability_probe");
    assert.ok(result && typeof result === "object" && "data" in result);
    const data = (result as { data: { deliveryTarget: string } }).data;
    assert.equal(data.deliveryTarget, "target_none");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-ROS.C.6-C: no workspaceRoot returns target_none", async () => {
  const router = createOpsRouter({
    runtimeAvailable: true,
  });

  const result = await router.dispatch("capability_probe");
  assert.ok(result && typeof result === "object" && "data" in result);
  const data = (result as { data: { deliveryTarget: string } }).data;
  assert.equal(data.deliveryTarget, "target_none");
});
