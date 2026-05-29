/**
 * T-CS.C.9 — Instreet connector registration + platform_unavailable marking.
 *
 * Verifies:
 * A. instreet manifest is registered in the executor adapter registry.
 * B. instreet execution returns structured platform_unavailable (not unknown_platform).
 * C. compile check passes.
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
import { CapabilityContractRegistry } from "../../../src/connectors/base/manifest.js";
import { instreetManifest } from "../../../src/connectors/social-community/instreet/manifest.js";

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
    platformId: "instreet",
    credentialType: "api_key",
    encryptedValue: "mock-token",
    status: "active",
  });
}

test("T-CS.C.9-A: instreet manifest resolves capability in registry", () => {
  const registry = new CapabilityContractRegistry();
  registry.register({ ...instreetManifest });

  const resolved = registry.resolveCapability("notification.list", "instreet");
  assert.ok(resolved, "instreet notification.list must resolve");
  assert.equal(resolved.platformId, "instreet");
  assert.equal(resolved.intent, "notification.list");

  assert.ok(registry.hasCapability("instreet", "message.send"), "instreet must support message.send");
  assert.ok(!registry.hasCapability("instreet", "nonexistent.capability"), "nonexistent capability must not be supported");
});

test("T-CS.C.9-B: instreet execution returns platform_unavailable", async () => {
  const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "sn-instreet-"));
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot: emptyWorkspace,
    });

    const result = await executor.executeEffect({
      intent: "notification.list",
      platformId: "instreet",
      payload: {},
      decisionId: "dec-instreet-1",
      intentId: "intent-instreet-1",
      idempotencyKey: "instreet-list-1",
    });

    assert.equal(result.status, "terminal_failure", "instreet must return terminal_failure");
    assert.equal(result.failureClass, "platform_unavailable", "failureClass must be platform_unavailable");
  } finally {
    fs.rmSync(emptyWorkspace, { recursive: true, force: true });
  }
});

test("T-CS.C.9-C: instreet execution does not return unknown_platform", async () => {
  const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "sn-instreet-"));
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot: emptyWorkspace,
    });

    const result = await executor.executeEffect({
      intent: "message.send",
      platformId: "instreet",
      payload: {},
      decisionId: "dec-instreet-2",
      intentId: "intent-instreet-2",
      idempotencyKey: "instreet-send-1",
    });

    assert.equal(result.status, "terminal_failure");
    const resultJson = JSON.stringify(result);
    assert.ok(!resultJson.includes("unknown_platform"), "must not return unknown_platform");
    assert.ok(resultJson.includes("platform_unavailable"), "must return platform_unavailable");
  } finally {
    fs.rmSync(emptyWorkspace, { recursive: true, force: true });
  }
});
