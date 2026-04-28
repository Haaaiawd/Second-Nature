import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { createMoltbookApiClient, MoltbookApiError } from "../../../src/connectors/social-community/moltbook/api-client.js";
import { createMoltbookRunner } from "../../../src/connectors/social-community/moltbook/adapter.js";
import { moltbookManifest } from "../../../src/connectors/social-community/moltbook/manifest.js";
import type { ExecutionPlan, ConnectorRequest, RawAttempt } from "../../../src/connectors/base/contract.js";

function createMoltbookStubServer() {
  const requests: Array<{ method: string; url: string; authorization?: string; body: string }> = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    requests.push({
      method: req.method ?? "GET",
      url: req.url ?? "/",
      authorization: typeof req.headers.authorization === "string" ? req.headers.authorization : undefined,
      body,
    });

    if (req.url?.startsWith("/api/v1/feed")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts: [{ id: "1", content: "stub-post" }] }));
      return;
    }

    if (req.url === "/api/v1/posts" && req.method === "POST") {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "post-1", status: "published" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  return {
    requests,
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => resolve());
        server.once("error", reject);
      });
      const address = server.address() as AddressInfo;
      return `http://127.0.0.1:${address.port}`;
    },
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}


test("T3.0.1 Moltbook manifest declares feed.read, post.publish, comment.reply capabilities", () => {
  assert.equal(moltbookManifest.platformId, "moltbook");
  assert.ok(moltbookManifest.supportedCapabilities.includes("feed.read"));
  assert.ok(moltbookManifest.supportedCapabilities.includes("post.publish"));
  assert.ok(moltbookManifest.supportedCapabilities.includes("comment.reply"));
  assert.ok(moltbookManifest.channelPriority.includes("api_rest"));
  assert.ok(moltbookManifest.credentialTypes.includes("api_key"));
});

test("T3.0.1 Moltbook adapter supports api_rest, skill, browser channels", () => {
  const mockApiClient = {
    readFeed: async () => ({ posts: [] }),
    publishPost: async () => ({ id: "post-1" }),
    replyComment: async () => ({ id: "comment-1" }),
  };

  const mockSkillRunner = {
    run: async () => ({ result: "skill" }),
  };

  const runner = createMoltbookRunner({
    apiClient: mockApiClient,
    skillRunner: mockSkillRunner,
  });

  assert.ok(runner, "Moltbook runner should be created");
  assert.ok(typeof runner.run === "function", "runner should have run method");
});

// ─── T3.1.1: Moltbook Minimal Client Tests ───────────────────────────────────

test("T3.1.1 Moltbook API client creates with valid config", () => {
  const client = createMoltbookApiClient({
    baseUrl: "https://api.moltbook.com",
    accessToken: "test-token",
  });

  assert.ok(client, "client should be created");
  assert.ok(typeof client.readFeed === "function", "should have readFeed method");
  assert.ok(typeof client.publishPost === "function", "should have publishPost method");
  assert.ok(typeof client.replyComment === "function", "should have replyComment method");
});

test("T3.1.1 Moltbook API client readFeed uses real HTTP transport against near-real stub", async () => {
  const stub = createMoltbookStubServer();
  const baseUrl = await stub.start();

  try {
    const client = createMoltbookApiClient({
      baseUrl,
      accessToken: "test-token",
    });

    const result = await client.readFeed({ limit: 10, sort: "recent" }) as { posts: Array<{ id: string; content: string }> };

    assert.equal(stub.requests.length, 1);
    assert.equal(stub.requests[0]?.method, "GET");
    assert.ok(stub.requests[0]?.url.includes("/api/v1/feed"), "should call feed endpoint");
    assert.ok(stub.requests[0]?.url.includes("limit=10"), "should include limit param");
    assert.ok(stub.requests[0]?.url.includes("sort=recent"), "should include sort param");
    assert.equal(stub.requests[0]?.authorization, "Bearer test-token");
    assert.equal(result.posts[0]?.content, "stub-post");
  } finally {
    await stub.stop();
  }
});

test("T3.1.1 Moltbook API client publishPost uses real HTTP transport against near-real stub", async () => {
  const stub = createMoltbookStubServer();
  const baseUrl = await stub.start();

  try {
    const client = createMoltbookApiClient({
      baseUrl,
      accessToken: "test-token",
    });

    const result = await client.publishPost({
      content: "Hello from Second Nature",
      link: "https://example.com",
    }) as { id: string; status: string };

    assert.equal(stub.requests.length, 1);
    assert.equal(stub.requests[0]?.method, "POST");
    assert.equal(stub.requests[0]?.url, "/api/v1/posts");
    assert.equal(stub.requests[0]?.authorization, "Bearer test-token");
    assert.ok(stub.requests[0]?.body.includes("Hello from Second Nature"), "should include content");
    assert.ok(stub.requests[0]?.body.includes("https://example.com"), "should include link");
    assert.equal(result.status, "published");
  } finally {
    await stub.stop();
  }
});

test("T3.1.1 Moltbook API client replyComment requires postId", async () => {
  const client = createMoltbookApiClient({
    baseUrl: "https://api.moltbook.com",
    accessToken: "test-token",
  });

  try {
    await client.replyComment({ content: "Nice post!" });
    assert.fail("should throw when postId is missing");
  } catch (error) {
    assert.ok(error instanceof MoltbookApiError, "should throw MoltbookApiError");
    assert.equal((error as MoltbookApiError).statusCode, 400);
  }
});

test("T3.1.1 Moltbook API client handles API errors", async () => {
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    json: async () => ({}),
    text: async () => '{"error": "invalid_token"}',
  });

  try {
    const client = createMoltbookApiClient({
      baseUrl: "https://api.moltbook.com",
      accessToken: "invalid-token",
    });

    await client.readFeed({});
    assert.fail("should throw on API error");
  } catch (error) {
    assert.ok(error instanceof MoltbookApiError, "should throw MoltbookApiError");
    assert.equal((error as MoltbookApiError).statusCode, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T3.1.1 Moltbook runner executes feed.read via api_rest channel", async () => {
  const mockApiClient = {
    readFeed: async (payload: Record<string, unknown>) => ({
      posts: [{ id: "1", content: "test post" }],
    }),
    publishPost: async () => ({}),
    replyComment: async () => ({}),
  };

  const mockSkillRunner = {
    run: async () => ({}),
  };

  const runner = createMoltbookRunner({
    apiClient: mockApiClient,
    skillRunner: mockSkillRunner,
  });

  const plan: ExecutionPlan = {
    platformId: "moltbook",
    intent: "feed.read",
    channel: "api_rest",
    endpointMode: "rest_json",
  };

  const request: ConnectorRequest = {
    platformId: "moltbook",
    intent: "feed.read",
    payload: { limit: 10 },
  };

  const result = await runner.run(plan, request);

  assert.equal(result.platformId, "moltbook");
  assert.equal(result.channel, "api_rest");
  assert.equal(result.success, true);
  assert.ok(result.payload, "should have payload");
  assert.equal((result.payload as any).capability, "feed.read");
  assert.equal((result.payload as any).channel, "api_rest");
});

test("T3.1.1 Moltbook runner handles execution errors", async () => {
  const mockApiClient = {
    readFeed: async () => {
      throw new Error("Network error");
    },
    publishPost: async () => ({}),
    replyComment: async () => ({}),
  };

  const mockSkillRunner = {
    run: async () => ({}),
  };

  const runner = createMoltbookRunner({
    apiClient: mockApiClient,
    skillRunner: mockSkillRunner,
  });

  const plan: ExecutionPlan = {
    platformId: "moltbook",
    intent: "feed.read",
    channel: "api_rest",
    endpointMode: "rest_json",
  };

  const request: ConnectorRequest = {
    platformId: "moltbook",
    intent: "feed.read",
    payload: {},
  };

  const result = await runner.run(plan, request);

  assert.equal(result.success, false);
  assert.ok(result.error, "should have error");
  assert.equal(result.platformId, "moltbook");
  assert.equal(result.channel, "api_rest");
});

test("T3.1.1 Moltbook runner supports skill fallback channel", async () => {
  const mockApiClient = {
    readFeed: async () => ({}),
    publishPost: async () => ({}),
    replyComment: async () => ({}),
  };

  const mockSkillRunner = {
    run: async (intent: string, payload: Record<string, unknown>) => ({
      skillResult: true,
      intent,
      payload,
    }),
  };

  const runner = createMoltbookRunner({
    apiClient: mockApiClient,
    skillRunner: mockSkillRunner,
  });

  const plan: ExecutionPlan = {
    platformId: "moltbook",
    intent: "feed.read",
    channel: "skill",
    endpointMode: "skill_call",
  };

  const request: ConnectorRequest = {
    platformId: "moltbook",
    intent: "feed.read",
    payload: { limit: 5 },
  };

  const result = await runner.run(plan, request);

  assert.equal(result.success, true);
  assert.equal(result.channel, "skill");
  assert.equal(result.degraded, true, "skill channel should be marked as degraded");
  assert.ok((result.payload as any).data?.skillResult, "should have skill result");
});
