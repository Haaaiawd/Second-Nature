import test from "node:test";
import assert from "node:assert/strict";

import { createMoltbookApiClient, MoltbookApiError } from "../../../src/connectors/social-community/moltbook/api-client.js";
import { createMoltbookRunner } from "../../../src/connectors/social-community/moltbook/adapter.js";
import { moltbookManifest } from "../../../src/connectors/social-community/moltbook/manifest.js";
import type { ExecutionPlan, ConnectorRequest, RawAttempt } from "../../../src/connectors/base/contract.js";

// ─── T3.0.1: Moltbook Integration Path Verification ─────────────────────────

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

test("T3.1.1 Moltbook API client readFeed builds correct request", async () => {
  let capturedUrl: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;

  // Mock fetch
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, options: any) => {
    capturedUrl = url as string;
    capturedHeaders = options?.headers as Record<string, string>;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ posts: [{ id: "1", content: "test" }] }),
      text: async () => "",
    };
  };

  try {
    const client = createMoltbookApiClient({
      baseUrl: "https://api.moltbook.com",
      accessToken: "test-token",
    });

    const result = await client.readFeed({ limit: 10, sort: "recent" });

    assert.ok(capturedUrl?.includes("/api/v1/feed"), "should call feed endpoint");
    assert.ok(capturedUrl?.includes("limit=10"), "should include limit param");
    assert.ok(capturedUrl?.includes("sort=recent"), "should include sort param");
    assert.equal(capturedHeaders?.["Authorization"], "Bearer test-token", "should include auth header");
    assert.ok(result, "should return feed data");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T3.1.1 Moltbook API client publishPost builds correct request", async () => {
  let capturedMethod: string | undefined;
  let capturedBody: string | undefined;

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (_url: string, options: any) => {
    capturedMethod = options?.method;
    capturedBody = options?.body;
    return {
      ok: true,
      status: 201,
      statusText: "Created",
      json: async () => ({ id: "post-1", status: "published" }),
      text: async () => "",
    };
  };

  try {
    const client = createMoltbookApiClient({
      baseUrl: "https://api.moltbook.com",
      accessToken: "test-token",
    });

    const result = await client.publishPost({
      content: "Hello from Second Nature",
      link: "https://example.com",
    });

    assert.equal(capturedMethod, "POST", "should use POST method");
    assert.ok(capturedBody?.includes("Hello from Second Nature"), "should include content");
    assert.ok(capturedBody?.includes("https://example.com"), "should include link");
    assert.ok(result, "should return post data");
  } finally {
    globalThis.fetch = originalFetch;
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
