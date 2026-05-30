/**
 * T-CS.C.10 — EvoMap secret port persistence integration test.
 *
 * Verifies that createEvoMapSecretPort (backed by credential vault)
 * can save and load node_secret across process boundaries (SQLite).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

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
    platformId: "evomap",
    credentialType: "api_key",
    encryptedValue: "mock-api-key",
    status: "active",
  });
}

test("T-CS.C.10-G: evomap configuration_missing when base URL unset", async () => {
  const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "sn-evomap-"));
  try {
    const stateDb = createStateDatabase(":memory:");
    const observabilityDb = createObservabilityDatabase(":memory:");
    await seedCredential(stateDb);

    const executor = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot: emptyWorkspace,
    });

    delete process.env.SECOND_NATURE_EVOMAP_BASE_URL;

    const result = await executor.executeEffect({
      intent: "agent.heartbeat",
      platformId: "evomap",
      payload: {},
      decisionId: "dec-evomap-1",
      intentId: "intent-evomap-1",
      idempotencyKey: "evomap-heartbeat-1",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "configuration_missing");
  } finally {
    fs.rmSync(emptyWorkspace, { recursive: true, force: true });
  }
});

test("T-CS.C.10-H: secret port saveNodeSecret / loadNodeSecret round-trip", async () => {
  const stateDb = createStateDatabase(":memory:");
  const vault = createCredentialVault(stateDb.db);

  // Seed api_key for evomap (standard credential)
  await vault.saveCredentialContext({
    platformId: "evomap",
    credentialType: "api_key",
    encryptedValue: "mock-api-key",
    status: "active",
  });

  // Import the secret port factory from the built dist (same module, built)
  const { createEvoMapSecretPort } = await import("../../../src/connectors/services/connector-executor-adapter.js");
  const secretPort = createEvoMapSecretPort(vault);

  // Before save
  const before = await secretPort.loadNodeSecret("evomap");
  assert.equal(before, null, "node_secret must be null before save");

  // Save
  await secretPort.saveNodeSecret("evomap", "node-secret-42");

  // Load
  const after = await secretPort.loadNodeSecret("evomap");
  assert.equal(after, "node-secret-42", "node_secret must round-trip through vault");
});
