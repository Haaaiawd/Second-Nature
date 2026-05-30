/**
 * T-CS.C.11 — Scriptable node runner unit tests.
 *
 * Verifies createScriptableNodeRunner:
 * - manifest declares scriptable_node → executor loads and calls runner.mjs default export
 * - runner.mjs missing → configuration_missing with path
 * - runner.mjs throws → script_error with message
 * - runner.mjs timeout → timeout
 * - manifest schema accepts scriptable_node kind
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

test.beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
});

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
});

async function seedCredential(stateDb: ReturnType<typeof createStateDatabase>) {
  const vault = createCredentialVault(stateDb.db);
  await vault.saveCredentialContext({
    platformId: "scriptable-platform",
    credentialType: "api_key",
    encryptedValue: "mock-token",
    status: "active",
  });
}

function makeWorkspaceWithRunner(scriptContent: string, runnerConfig?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-scriptable-"));
  const connectorsDir = path.join(dir, ".second-nature", "connectors", "scriptable-platform");
  fs.mkdirSync(connectorsDir, { recursive: true });
  const configBlock = runnerConfig
    ? `  config:\n${Object.entries(runnerConfig)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
        .join("\n")}\n`
    : "";
  fs.writeFileSync(
    path.join(connectorsDir, "manifest.yaml"),
    `schemaVersion: "sn.connector.v1"
platformId: "scriptable-platform"
displayName: "Scriptable Platform"
family: "custom"
capabilities:
  - id: "task.run"
    channel: "api_rest"
runner:
  kind: "scriptable_node"
  entrypoint: "runner.mjs"
${configBlock}credentials:
  - type: "api_key"
    required: false
sourceRefPolicy:
  minSourceRefs: 1
trust:
  status: "declarative_trusted"
`,
    "utf-8",
  );
  fs.writeFileSync(path.join(connectorsDir, "runner.mjs"), scriptContent, "utf-8");
  return dir;
}

test("T-CS.C.11-A: scriptable_node executor loads runner.mjs and returns success", async () => {
  const workspaceRoot = makeWorkspaceWithRunner(`
export default async function handler(input) {
  return { success: true, data: { result: "hello-from-script", intent: input.intent } };
}
`);
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "task.run",
      platformId: "scriptable-platform",
      payload: { value: 42 },
      decisionId: "dec-script-1",
      intentId: "intent-script-1",
      idempotencyKey: "script-task-1",
    });

    assert.equal(result.status, "success", `expected success, got ${JSON.stringify(result)}`);
    assert.ok(result.data, "result must contain data");
    const payload = result.data as Record<string, unknown>;
    const data = payload.data as Record<string, unknown>;
    assert.equal(data.result, "hello-from-script");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.11-B: missing runner.mjs returns configuration_missing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-scriptable-missing-"));
  const connectorsDir = path.join(dir, ".second-nature", "connectors", "scriptable-platform");
  fs.mkdirSync(connectorsDir, { recursive: true });
  fs.writeFileSync(
    path.join(connectorsDir, "manifest.yaml"),
    `schemaVersion: "sn.connector.v1"
platformId: "scriptable-platform"
displayName: "Scriptable Platform"
family: "custom"
capabilities:
  - id: "task.run"
    channel: "api_rest"
runner:
  kind: "scriptable_node"
  entrypoint: "runner.mjs"
credentials:
  - type: "api_key"
    required: false
sourceRefPolicy:
  minSourceRefs: 1
trust:
  status: "declarative_trusted"
`,
    "utf-8",
  );
  // Note: runner.mjs intentionally not written

  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot: dir,
    });

    const result = await executor.executeEffect({
      intent: "task.run",
      platformId: "scriptable-platform",
      payload: {},
      decisionId: "dec-script-2",
      intentId: "intent-script-2",
      idempotencyKey: "script-task-2",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "configuration_missing");
    assert.ok(JSON.stringify(result).includes("runner.mjs"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("T-CS.C.11-C: runner.mjs throws returns script_error", async () => {
  const workspaceRoot = makeWorkspaceWithRunner(`
export default async function handler() {
  throw new Error("intentional_runner_crash");
}
`);
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "task.run",
      platformId: "scriptable-platform",
      payload: {},
      decisionId: "dec-script-3",
      intentId: "intent-script-3",
      idempotencyKey: "script-task-3",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "script_error");
    assert.ok(JSON.stringify(result).includes("intentional_runner_crash"));
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.11-D: runner.mjs timeout returns timeout", async () => {
  const workspaceRoot = makeWorkspaceWithRunner(`
export default async function handler() {
  await new Promise((resolve) => setTimeout(resolve, 20000));
  return { success: true };
}
`);
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const result = await executor.executeEffect({
      intent: "task.run",
      platformId: "scriptable-platform",
      payload: {},
      decisionId: "dec-script-4",
      intentId: "intent-script-4",
      idempotencyKey: "script-task-4",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "timeout");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T-CS.C.11-E: manifest runner.config.timeoutMs overrides default timeout", async () => {
  const workspaceRoot = makeWorkspaceWithRunner(
    `
export default async function handler() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return { success: true };
}
`,
    { timeoutMs: 500 },
  );
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });

    const t0 = Date.now();
    const result = await executor.executeEffect({
      intent: "task.run",
      platformId: "scriptable-platform",
      payload: {},
      decisionId: "dec-script-5",
      intentId: "intent-script-5",
      idempotencyKey: "script-task-5",
    });
    const elapsed = Date.now() - t0;

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "timeout");
    assert.ok(
      elapsed < 3000,
      `expected timeout under 3s (500ms × 2 attempts + retry delay), but took ${elapsed}ms`,
    );
    assert.ok(
      JSON.stringify(result).includes("500ms"),
      `expected error detail to mention 500ms timeout, got ${JSON.stringify(result)}`,
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
