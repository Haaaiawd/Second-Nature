/**
 * Wave 83 — Declarative HTTP Runner integration test
 *
 * Verifies that a workspace connector with runner.kind=declarative_http
 * and runner.config.baseUrl is executed by the generic HTTP runner.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createConnectorExecutorAdapter } from "../../../src/connectors/services/connector-executor-adapter.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";

const ORIGINAL_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

async function seedCredential(stateDb: ReturnType<typeof createStateDatabase>, platformId: string) {
  const vault = createCredentialVault(stateDb.db);
  await vault.saveCredentialContext({
    platformId,
    credentialType: "api_key",
    encryptedValue: "test-token",
    status: "active",
  });
}

function createTestServer(
  responseData: unknown,
  onRequest?: (req: http.IncomingMessage) => void,
): { server: http.Server; port: number; url: string } {
  const server = http.createServer((req, res) => {
    onRequest?.(req);
    res.writeHead(200, { "Content-Type": "application/json" });
    const baseResponse = { path: req.url, method: req.method };
    const merged = typeof responseData === "object" && responseData !== null
      ? { ...baseResponse, ...responseData }
      : baseResponse;
    res.end(JSON.stringify(merged));
  });
  // Use random port
  server.listen(0);
  const address = server.address() as { port: number };
  return {
    server,
    port: address.port,
    url: `http://localhost:${address.port}`,
  };
}

function tempWorkspaceWithConnector(manifestContent: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-http-test-"));
  const connectorDir = path.join(dir, ".second-nature", "connectors", "my-custom-api");
  fs.mkdirSync(connectorDir, { recursive: true });
  fs.writeFileSync(path.join(connectorDir, "manifest.yaml"), manifestContent, "utf-8");
  return dir;
}

test.beforeEach(() => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
});

test("W83: declarative_http connector with credentials: [] executes without Authorization header", async () => {
  let authHeader: string | undefined;
  const { server, url } = createTestServer(
    { ok: true },
    (req) => {
      authHeader = req.headers.authorization;
    },
  );

  try {
    const manifest = `schemaVersion: sn.connector.v1
platformId: public-api
displayName: Public API
family: custom
capabilities:
  - id: feed.read
    description: Read public feed
runner:
  kind: declarative_http
  entrypoint: ""
  config:
    baseUrl: ${url}
credentials: []
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: declarative_trusted
`;
    const workspaceRoot = tempWorkspaceWithConnector(manifest);

    try {
      const stateDb = createStateDatabase(":memory:");
      const observabilityDb = createObservabilityDatabase(":memory:");

      const executor = createConnectorExecutorAdapter({
        stateDb,
        observabilityDb,
        workspaceRoot,
      });

      const result = await executor.executeEffect({
        intent: "feed.read",
        platformId: "public-api",
        payload: {},
        decisionId: "dec-w83-public",
        intentId: "intent-w83-public",
        idempotencyKey: "w83-public-api",
      });

      assert.equal(result.status, "success", `should succeed without credential: ${JSON.stringify(result)}`);
      assert.equal(authHeader, undefined, "public connector must not send Authorization header");
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  } finally {
    server.close();
  }
});

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
  else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_KEY;
});

test("W83: declarative_http workspace connector executes via generic HTTP runner", async () => {
  const { server, url } = createTestServer({ items: [{ id: "1", title: "Hello" }] });

  try {
    const manifest = `schemaVersion: sn.connector.v1
platformId: my-custom-api
displayName: My Custom API
family: custom
capabilities:
  - id: feed.read
    description: Read feed
runner:
  kind: declarative_http
  entrypoint: ""
  config:
    baseUrl: ${url}
credentials:
  - type: api_key
    required: true
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: declarative_trusted
  reason: test_fixture
`;
    const workspaceRoot = tempWorkspaceWithConnector(manifest);

    try {
      const stateDb = createStateDatabase(":memory:");
      const observabilityDb = createObservabilityDatabase(":memory:");
      await seedCredential(stateDb, "my-custom-api");

      const executor = createConnectorExecutorAdapter({
        stateDb,
        observabilityDb,
        workspaceRoot,
      });

      const result = await executor.executeEffect({
        intent: "feed.read",
        platformId: "my-custom-api",
        payload: {},
        decisionId: "dec-w83-1",
        intentId: "intent-w83-1",
        idempotencyKey: "w83-custom-api-1",
      });

      assert.equal(result.status, "success", `should succeed: ${JSON.stringify(result)}`);
      assert.ok(result.data, "result must have data");
      const payload = result.data as Record<string, unknown>;
      const data = payload.data as Record<string, unknown>;
      assert.equal(data.path, "/feed/read", "should map capability to REST path");
      assert.equal(data.method, "GET", "feed.read should use GET");
      assert.ok(Array.isArray(data.items), "should return server response");
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  } finally {
    server.close();
  }
});

test("W83: declarative_http POST capability uses POST method", async () => {
  const { server, url } = createTestServer({ created: true });

  try {
    const manifest = `schemaVersion: sn.connector.v1
platformId: my-post-api
displayName: My Post API
family: custom
capabilities:
  - id: post.publish
    description: Publish post
runner:
  kind: declarative_http
  entrypoint: ""
  config:
    baseUrl: ${url}
credentials:
  - type: api_key
    required: true
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: declarative_trusted
`;
    const workspaceRoot = tempWorkspaceWithConnector(manifest);

    try {
      const stateDb = createStateDatabase(":memory:");
      const observabilityDb = createObservabilityDatabase(":memory:");
      await seedCredential(stateDb, "my-post-api");

      const executor = createConnectorExecutorAdapter({
        stateDb,
        observabilityDb,
        workspaceRoot,
      });

      const result = await executor.executeEffect({
        intent: "post.publish",
        platformId: "my-post-api",
        payload: { content: "Hello world" },
        decisionId: "dec-w83-2",
        intentId: "intent-w83-2",
        idempotencyKey: "w83-post-1",
      });

      assert.equal(result.status, "success");
      const payload = result.data as Record<string, unknown>;
      const data = payload.data as Record<string, unknown>;
      assert.equal(data.path, "/post/publish");
      assert.equal(data.method, "POST");
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  } finally {
    server.close();
  }
});
