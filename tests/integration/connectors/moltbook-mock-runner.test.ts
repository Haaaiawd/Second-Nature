/**
 * Wave 81 — Moltbook Mock Runner integration tests
 *
 * Verifies that when SECOND_NATURE_MOLTBOOK_BASE_URL is unset,
 * the connector executor falls back to reading workspace mock data.
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
const ORIGINAL_MOLTBOOK_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;

function tempWorkspaceWithMock(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-mock-test-"));
  const mockDir = path.join(dir, ".second-nature", "mock");
  fs.mkdirSync(mockDir, { recursive: true });
  fs.writeFileSync(
    path.join(mockDir, "moltbook-feed.json"),
    JSON.stringify({
      items: [
        { id: "test-1", title: "Test item 1", content: "Hello from mock" },
        { id: "test-2", title: "Test item 2", content: "Another mock item" },
      ],
    }),
    "utf-8",
  );
  return dir;
}

test.beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
});

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_MOLTBOOK_URL === undefined) delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
  else process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = ORIGINAL_MOLTBOOK_URL;
});

async function seedCredential(stateDb: ReturnType<typeof createStateDatabase>) {
  const vault = createCredentialVault(stateDb.db);
  await vault.saveCredentialContext({
    platformId: "moltbook",
    credentialType: "api_key",
    encryptedValue: "mock-token",
    status: "active",
  });
}

test("W81: moltbook mock runner returns success when mock data exists", async () => {
  const workspaceRoot = tempWorkspaceWithMock();
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
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-mock-1",
      intentId: "intent-mock-1",
      idempotencyKey: "mock-feed-read-1",
    });

    assert.equal(result.status, "success", `mock execution should succeed, got: ${JSON.stringify(result)}`);
    assert.ok(result.data, "result must contain data");
    const payload = result.data as Record<string, unknown>;
    const data = payload.data as Record<string, unknown>;
    assert.equal(data.source, "mock", "result must be tagged as mock source");
    assert.ok(Array.isArray(data.items), "mock result must contain items array");
    assert.equal(data.items.length, 2, "mock result must contain 2 items");
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("W81: moltbook mock runner returns terminal_failure when no mock data", async () => {
  const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "sn-empty-"));
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
      intent: "feed.read",
      platformId: "moltbook",
      payload: {},
      decisionId: "dec-mock-2",
      intentId: "intent-mock-2",
      idempotencyKey: "mock-feed-read-2",
    });

    assert.equal(result.status, "terminal_failure", "should fail when no mock data and no base URL");
  } finally {
    fs.rmSync(emptyWorkspace, { recursive: true, force: true });
  }
});
