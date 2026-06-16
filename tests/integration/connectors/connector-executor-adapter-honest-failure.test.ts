/**
 * Integration test: createConnectorExecutorAdapter honest failure paths.
 *
 * When credentials or base URLs are missing, the adapter returns terminal_failure
 * instead of throwing, keeping the heartbeat loop stable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createStateDatabase } from "../../../src/storage/index.js";
import { createObservabilityDatabase } from "../../../src/observability/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";
import { extractNormalizedEvidenceItems } from "../../../src/connectors/base/normalized-evidence-content.js";
import { connectorInit } from "../../../src/cli/commands/connector-init.js";
import { connectorBehaviorAdd } from "../../../src/cli/commands/connector-behavior.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;
const ORIGINAL_MOLTBOOK_BASE_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
const ORIGINAL_AGENT_WORLD_BASE_URL = process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL;
const ORIGINAL_AGENT_WORLD_USERNAME = process.env.SECOND_NATURE_AGENT_WORLD_USERNAME;
const ORIGINAL_AGENT_WORLD_PROFILE_PATH_TEMPLATE =
  process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE;

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_MOLTBOOK_BASE_URL === undefined) delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
  else process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = ORIGINAL_MOLTBOOK_BASE_URL;
  if (ORIGINAL_AGENT_WORLD_BASE_URL === undefined) delete process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL;
  else process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL = ORIGINAL_AGENT_WORLD_BASE_URL;
  if (ORIGINAL_AGENT_WORLD_USERNAME === undefined) delete process.env.SECOND_NATURE_AGENT_WORLD_USERNAME;
  else process.env.SECOND_NATURE_AGENT_WORLD_USERNAME = ORIGINAL_AGENT_WORLD_USERNAME;
  if (ORIGINAL_AGENT_WORLD_PROFILE_PATH_TEMPLATE === undefined) {
    delete process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE;
  } else {
    process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE =
      ORIGINAL_AGENT_WORLD_PROFILE_PATH_TEMPLATE;
  }
});

test("connector executor adapter loads workspace-defined behavior and fails closed at runner boundary", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sn-dynamic-executor-"));
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  try {
    await connectorInit({ platformId: "github", workspaceRoot });
    const add = await connectorBehaviorAdd({
      platformId: "github",
      behaviorId: "issue.search",
      description: "Search issues before deciding whether to comment",
      sourceRefs: ["quiet:proposal:github-issue-search"],
      workspaceRoot,
    });
    assert.equal(add.ok, true);

    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });
    const result = await adapter.executeEffect({
      platformId: "github",
      intent: "issue.search",
      payload: {},
      decisionId: "dec-dynamic-1",
      intentId: "intent-dynamic-1",
      idempotencyKey: "idem-dynamic-1",
    });

    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, "configuration_missing");
    assert.equal(result.metadata.platformId, "github");
  } finally {
    stateDb.close();
    observabilityDb.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("connector executor adapter returns terminal_failure when credential missing", async () => {
  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
    });
    const result = await adapter.executeEffect({
      platformId: "moltbook",
      intent: "feed.read",
      payload: {},
      decisionId: "dec-test-1",
      intentId: "intent-test-1",
      idempotencyKey: "idem-test-1",
    });

    assert.equal(result.status, "terminal_failure");
    assert.ok(
      result.failureClass === "auth_failure",
      `Expected auth_failure, got: ${result.failureClass}`,
    );
    assert.equal(result.metadata.platformId, "moltbook");
  } finally {
    stateDb.close();
    observabilityDb.close();
  }
});

test("connector executor adapter returns terminal_failure for evomap (not yet implemented)", async () => {
  const stateDb = createStateDatabase();
  const observabilityDb = createObservabilityDatabase();
  try {
    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
    });
    const result = await adapter.executeEffect({
      platformId: "evomap",
      intent: "work.discover",
      payload: {},
      decisionId: "dec-test-2",
      intentId: "intent-test-2",
      idempotencyKey: "idem-test-2",
    });

    assert.equal(result.status, "terminal_failure");
    assert.ok(
      result.failureClass === "auth_failure" ||
        result.failureClass === "unknown_platform_change",
      `Expected auth_failure or unknown_platform_change, got: ${result.failureClass}`,
    );
    assert.equal(result.metadata.platformId, "evomap");
  } finally {
    stateDb.close();
    observabilityDb.close();
  }
});

test("connector executor adapter reads sql.js credential row and reaches Moltbook API", async () => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = "https://moltbook.test";

  const originalFetch = globalThis.fetch;
  let observedAuthorization: string | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    observedAuthorization = headers?.Authorization ?? headers?.authorization;
    return new Response(JSON.stringify({ items: [{ id: "mb-1", title: "ok" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  try {
    const vault = createCredentialVault(stateDb.db);
    await vault.saveCredentialContext({
      platformId: "moltbook",
      credentialType: "api_key",
      encryptedValue: "token-123",
      status: "active",
    });

    const loaded = await vault.loadCredentialContext("moltbook");
    assert.equal(loaded?.platformId, "moltbook");
    assert.equal(loaded?.credentialType, "api_key");
    assert.equal(loaded?.status, "active");
    assert.equal(loaded?.encryptedValue, "token-123");

    const adapter = createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
    });
    const result = await adapter.executeEffect({
      platformId: "moltbook",
      intent: "feed.read",
      payload: { limit: 1 },
      decisionId: "dec-test-success",
      intentId: "intent-test-success",
      idempotencyKey: "idem-test-success",
    });

    assert.equal(result.status, "success");
    assert.equal(result.metadata.platformId, "moltbook");
    assert.equal(observedAuthorization, "Bearer token-123");

    // T-CS.R.5 followup: real API runner payload must be v8-extractable
    const v8Items = extractNormalizedEvidenceItems(result.data, {
      platformId: "moltbook",
      capabilityId: "feed.read",
      observedAt: new Date().toISOString(),
      summaryProducer: "connector_rules",
    });
    assert.equal(v8Items.length, 1, "real API runner payload must yield one v8 EvidenceItem candidate");
    assert.equal(v8Items[0]?.externalId, "mb-1");
    assert.equal(v8Items[0]?.title, "ok");
  } finally {
    globalThis.fetch = originalFetch;
    stateDb.close();
    observabilityDb.close();
  }
});

test("agent-world feed.read uses real profile endpoint and vault credential", async () => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL = "https://agent-world.test";

  const originalFetch = globalThis.fetch;
  let observedUrl = "";
  let observedAuthorization: string | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    observedUrl = String(url);
    const headers = init?.headers as Record<string, string> | undefined;
    observedAuthorization = headers?.Authorization ?? headers?.authorization;
    return new Response(JSON.stringify({ username: "nyx_ha" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  try {
    const vault = createCredentialVault(stateDb.db);
    await vault.saveCredentialContext({
      platformId: "agent-world",
      credentialType: "api_key",
      encryptedValue: "agent-token-123",
      status: "active",
    });

    const adapter = createConnectorExecutorAdapter({ stateDb, observabilityDb });
    const result = await adapter.executeEffect({
      platformId: "agent-world",
      intent: "feed.read",
      payload: {},
      decisionId: "dec-agent-feed",
      intentId: "intent-agent-feed",
      idempotencyKey: "idem-agent-feed",
    });

    assert.equal(result.status, "success");
    assert.equal(observedUrl, "https://agent-world.test/api/agents/profile/nyx_ha");
    assert.equal(observedAuthorization, "Bearer agent-token-123");
  } finally {
    globalThis.fetch = originalFetch;
    stateDb.close();
    observabilityDb.close();
  }
});

test("agent-world work.discover allows Claw to choose target username", async () => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL = "https://agent-world.test";

  const originalFetch = globalThis.fetch;
  let observedUrl = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    observedUrl = String(url);
    return new Response(JSON.stringify({ username: "other_agent" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  try {
    const vault = createCredentialVault(stateDb.db);
    await vault.saveCredentialContext({
      platformId: "agent-world",
      credentialType: "api_key",
      encryptedValue: "agent-token-456",
      status: "active",
    });

    const adapter = createConnectorExecutorAdapter({ stateDb, observabilityDb });
    const result = await adapter.executeEffect({
      platformId: "agent-world",
      intent: "work.discover",
      payload: { targetUsername: "other agent" },
      decisionId: "dec-agent-discover",
      intentId: "intent-agent-discover",
      idempotencyKey: "idem-agent-discover",
    });

    assert.equal(result.status, "success");
    assert.equal(observedUrl, "https://agent-world.test/api/agents/profile/other%20agent");
  } finally {
    globalThis.fetch = originalFetch;
    stateDb.close();
    observabilityDb.close();
  }
});

test("agent-world profile path template is configurable", async () => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL = "https://agent-world.test";
  process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE =
    "/api/custom/agents/{username}/profile";

  const originalFetch = globalThis.fetch;
  let observedUrl = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    observedUrl = String(url);
    return new Response(JSON.stringify({ username: "custom_agent" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  try {
    const vault = createCredentialVault(stateDb.db);
    await vault.saveCredentialContext({
      platformId: "agent-world",
      credentialType: "api_key",
      encryptedValue: "agent-token-789",
      status: "active",
    });

    const adapter = createConnectorExecutorAdapter({ stateDb, observabilityDb });
    const result = await adapter.executeEffect({
      platformId: "agent-world",
      intent: "feed.read",
      payload: { username: "custom_agent" },
      decisionId: "dec-agent-custom",
      intentId: "intent-agent-custom",
      idempotencyKey: "idem-agent-custom",
    });

    assert.equal(result.status, "success");
    assert.equal(observedUrl, "https://agent-world.test/api/custom/agents/custom_agent/profile");
  } finally {
    globalThis.fetch = originalFetch;
    stateDb.close();
    observabilityDb.close();
  }
});
