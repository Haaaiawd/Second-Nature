/**
 * Wave 83 — connector-init manifest generation tests
 *
 * Verifies that connectorInit generates correct manifest structure:
 * - declarative_http → trust.status = declarative_trusted
 * - baseUrl → placed in runner.config.baseUrl
 * - custom_adapter → trust.status = custom_adapter_pending_trust
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { connectorInit } from "../../../src/cli/commands/connector-init.js";

describe("connectorInit manifest generation (W83)", () => {
  it("declarative_http with baseUrl generates declarative_trusted + config.baseUrl", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-init-test-"));
    try {
      const result = await connectorInit({
        platformId: "my-api",
        runnerKind: "declarative_http",
        baseUrl: "https://my-api.example.com",
        workspaceRoot: tmpDir,
      });

      assert.ok(result.created, "manifest should be created");
      const manifestContent = fs.readFileSync(result.manifestPath, "utf-8");

      assert.ok(
        manifestContent.includes("status: declarative_trusted"),
        "declarative_http should have declarative_trusted trust status",
      );
      assert.ok(
        manifestContent.includes("config:") && manifestContent.includes("baseUrl: https://my-api.example.com"),
        "baseUrl should be nested under runner.config",
      );
      assert.ok(
        !manifestContent.includes("baseUrl:") || manifestContent.includes("runner:") && manifestContent.indexOf("baseUrl:") > manifestContent.indexOf("runner:"),
        "baseUrl should not be at top-level",
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("custom_adapter without baseUrl generates pending_trust", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-init-test-"));
    try {
      const result = await connectorInit({
        platformId: "my-custom",
        runnerKind: "custom_adapter",
        workspaceRoot: tmpDir,
      });

      assert.ok(result.created, "manifest should be created");
      const manifestContent = fs.readFileSync(result.manifestPath, "utf-8");

      assert.ok(
        manifestContent.includes("status: custom_adapter_pending_trust"),
        "custom_adapter should have pending_trust status",
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("declarative_a2a and declarative_mcp also generate declarative_trusted", async () => {
    for (const kind of ["declarative_a2a", "declarative_mcp"] as const) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-init-test-"));
      try {
        const result = await connectorInit({
          platformId: `my-${kind}`,
          runnerKind: kind,
          workspaceRoot: tmpDir,
        });
        const manifestContent = fs.readFileSync(result.manifestPath, "utf-8");
        assert.ok(
          manifestContent.includes("status: declarative_trusted"),
          `${kind} should have declarative_trusted trust status`,
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });
});
