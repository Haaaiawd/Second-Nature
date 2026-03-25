import test from "node:test";
import assert from "node:assert/strict";

import {
  CapabilityContractRegistry,
  ChannelHealthStore,
  ConnectorRoutePlanner,
  createConnectorContractCore,
  type RouteContextPort,
} from "../../../src/connectors/base/index.js";
import { createMoltbookRunner, moltbookManifest, MOLTBOOK_DOC_RISK } from "../../../src/connectors/social-community/moltbook/index.js";
import { createInStreetRunner, instreetManifest } from "../../../src/connectors/social-community/instreet/index.js";
import { createEvoMapRunner, evomapManifest } from "../../../src/connectors/agent-network/evomap/index.js";

function makeStatePort(stateByPlatform: Record<string, "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed">): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: stateByPlatform[platformId] ?? "active",
        credentialType: "api_key",
        encryptedValue: "token-123",
      };
    },
    async loadCooldownState() {
      return { blocked: false };
    },
  };
}

test("moltbook adapter returns normalized result and keeps replaceable seam for skill/doc risk", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register(moltbookManifest);

  const routePlanner = new ConnectorRoutePlanner(
    registry,
    makeStatePort({ moltbook: "active" }),
    new ChannelHealthStore()
  );

  const runner = createMoltbookRunner({
    apiClient: {
      async readFeed() {
        return [{ id: "post-1" }];
      },
      async publishPost(payload) {
        return { id: "new-post", text: payload.text };
      },
      async replyComment(payload) {
        return { id: "reply-1", body: payload.body };
      },
    },
    skillRunner: {
      async run() {
        return { via: "skill" };
      },
    },
  });

  const core = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner,
    executionRunner: runner,
  });

  const result = await core.executeCapability("feed.read", {
    platformId: "moltbook",
    intent: "feed.read",
    payload: { topic: "ai" },
  });

  assert.equal(result.status, "success");
  assert.equal(result.metadata.channel, "api_rest");
  assert.ok(MOLTBOOK_DOC_RISK.key.includes("doc"));
});

test("instreet adapter uses canonical pending_verification recovery and api_rest boundary", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register(instreetManifest);

  const routePlanner = new ConnectorRoutePlanner(
    registry,
    makeStatePort({ instreet: "pending_verification" }),
    new ChannelHealthStore()
  );

  let persistedStatus: string | undefined;

  const runner = createInStreetRunner({
    apiClient: {
      async listNotifications(payload, apiKey) {
        return { notifications: [], apiKeyUsed: apiKey, payload };
      },
      async sendMessage(payload, apiKey) {
        return { sent: true, apiKeyUsed: apiKey, payload };
      },
      async replyComment(payload, apiKey) {
        return { replied: true, apiKeyUsed: apiKey, payload };
      },
      async heartbeat(apiKey) {
        return { ok: true, apiKeyUsed: apiKey };
      },
    },
    skillRunner: {
      async resumeVerification() {
        return { status: "active" as const, apiKey: "instreet-key" };
      },
      async run(intent, payload, context) {
        return { via: "skill", intent, payload, apiKeyUsed: context.apiKey };
      },
    },
    credentialPort: {
      async loadCredentialState(platformId) {
        return {
          platformId,
          status: "pending_verification",
          credentialType: "api_key",
          verificationCode: "code",
          challengeText: "challenge",
        };
      },
      async persistVerificationOutcome(_platformId, outcome) {
        persistedStatus = outcome.status;
      },
    },
  });

  const core = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner,
    executionRunner: runner,
  });

  const result = await core.executeCapability("notification.list", {
    platformId: "instreet",
    intent: "notification.list",
    payload: {},
  });

  assert.equal(result.status, "success");
  assert.equal(result.metadata.channel, "skill");
  assert.equal(persistedStatus, "active");
  assert.equal((result.data as { data?: { via?: string } }).data?.via, "skill");
});

test("evomap adapter enforces node_secret and separates a2a/api_rest bindings", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register(evomapManifest);

  const routePlanner = new ConnectorRoutePlanner(
    registry,
    makeStatePort({ evomap: "active" }),
    new ChannelHealthStore()
  );

  let storedSecret: string | null = null;
  const runner = createEvoMapRunner({
    apiClient: {
      async heartbeat(_payload, nodeSecret) {
        return { heartbeat: "ok", nodeSecret };
      },
      async claimTask(_payload, nodeSecret) {
        return { claimed: "t1", nodeSecret };
      },
    },
    a2aClient: {
      async helloOrRegister() {
        return { your_node_id: "node-1", node_secret: "secret-1" };
      },
      async discoverWork(_payload, nodeSecret) {
        return { tasks: ["t1"], nodeSecret };
      },
    },
    secretPort: {
      async loadNodeSecret() {
        return storedSecret;
      },
      async saveNodeSecret(_platformId, nodeSecret) {
        storedSecret = nodeSecret;
      },
    },
  });

  const core = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner,
    executionRunner: runner,
  });

  const reg = await core.executeCapability("agent.register", {
    platformId: "evomap",
    intent: "agent.register",
    payload: {},
    preferredChannel: "a2a",
  });
  assert.equal(reg.status, "success");
  assert.equal(storedSecret, "secret-1");

  const discover = await core.executeCapability("work.discover", {
    platformId: "evomap",
    intent: "work.discover",
    payload: {},
    preferredChannel: "a2a",
  });
  assert.equal(discover.status, "success");
  assert.equal(discover.metadata.channel, "a2a");

  const heartbeat = await core.executeCapability("agent.heartbeat", {
    platformId: "evomap",
    intent: "agent.heartbeat",
    payload: {},
  });
  assert.equal(heartbeat.status, "success");
  assert.equal(heartbeat.metadata.channel, "api_rest");

  const claim = await core.executeCapability("task.claim", {
    platformId: "evomap",
    intent: "task.claim",
    payload: {},
  });
  assert.equal(claim.status, "success");

  const wrongChannel = await core.executeCapability("agent.heartbeat", {
    platformId: "evomap",
    intent: "agent.heartbeat",
    payload: {},
    preferredChannel: "a2a",
  });
  assert.equal(wrongChannel.status, "terminal_failure");
  assert.equal(wrongChannel.failureClass, "protocol_mismatch");
});
