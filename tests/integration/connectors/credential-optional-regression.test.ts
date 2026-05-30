/**
 * Regression test for R-S9-01:
 * When a workspace manifest declares credentials with `required: false`,
 * route-planner must NOT throw `auth_failure` even if the credential is missing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createStateDatabase } from "../../../src/storage/index.js";
import { createObservabilityDatabase } from "../../../src/observability/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";

test("optional credential (required: false) does not cause auth_failure when missing", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-optional-cred-"));
  const platformDir = path.join(workspaceRoot, ".second-nature", "connectors", "optional-platform");
  fs.mkdirSync(platformDir, { recursive: true });

  const manifestPath = path.join(platformDir, "manifest.yaml");
  const manifestYaml = `schemaVersion: sn.connector.v1
platformId: optional-platform
displayName: Optional Platform
family: custom
capabilities:
  - id: optional-platform.greet
    description: Greet the platform
runner:
  kind: scriptable_node
  entrypoint: "runner.mjs"
credentials:
  - type: api_key
    required: false
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: declarative_trusted
  reason: generated_by_regression_test
`;
  fs.writeFileSync(manifestPath, manifestYaml);
  fs.writeFileSync(
    path.join(platformDir, "runner.mjs"),
    `export default async function handler() { return { success: true, data: { greeting: "hello" } }; }\n`,
    "utf-8",
  );

  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await adapter.executeEffect({
      platformId: "optional-platform",
      intent: "optional-platform.greet",
      payload: {},
      decisionId: "dec-opt-1",
      intentId: "intent-opt-1",
      idempotencyKey: "idem-opt-1",
    });

    assert.notEqual(
      result.failureClass,
      "auth_failure",
      `Optional credential must not cause auth_failure, got: ${result.failureClass} (${result.status})`,
    );
    assert.notEqual(
      result.status,
      "terminal_failure",
      `Optional credential should not terminal-fail due to auth; got terminal_failure`,
    );
  } finally {
    stateDb.close();
    observabilityDb.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("required credential (default) still causes auth_failure when missing", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-required-cred-"));
  const platformDir = path.join(workspaceRoot, ".second-nature", "connectors", "required-platform");
  fs.mkdirSync(platformDir, { recursive: true });

  const manifestPath = path.join(platformDir, "manifest.yaml");
  const manifestYaml = `schemaVersion: sn.connector.v1
platformId: required-platform
displayName: Required Platform
family: custom
capabilities:
  - id: required-platform.greet
    description: Greet the platform
runner:
  kind: declarative_http
  entrypoint: ""
  config:
    baseUrl: http://localhost:99999
credentials:
  - type: api_key
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: declarative_trusted
  reason: generated_by_regression_test
`;
  fs.writeFileSync(manifestPath, manifestYaml);

  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await adapter.executeEffect({
      platformId: "required-platform",
      intent: "required-platform.greet",
      payload: {},
      decisionId: "dec-req-1",
      intentId: "intent-req-1",
      idempotencyKey: "idem-req-1",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "auth_failure");
  } finally {
    stateDb.close();
    observabilityDb.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
