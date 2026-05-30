/**
 * T-CS.C.10 — EvoMap runner unit tests.
 *
 * Verifies createEvoMapRunner with mock clients:
 * - agent.register saves node_secret via a2a
 * - agent.heartbeat sends api request with node_secret
 * - work.discover uses a2a channel
 * - task.claim uses api_rest channel
 * - unsupported intent throws protocol_mismatch
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createEvoMapRunner, type EvoMapApiClient, type EvoMapA2AClient, type EvoMapSecretPort } from "../../../src/connectors/agent-network/evomap/adapter.js";
import type { ExecutionPlan, ConnectorRequest } from "../../../src/connectors/base/contract.js";

function makePlan(intent: string, channel: ExecutionPlan["channel"]): ExecutionPlan {
  return {
    platformId: "evomap",
    intent: intent as ExecutionPlan["intent"],
    channel,
    endpointMode: channel === "a2a" ? "a2a_envelope" : "rest_json",
    degraded: channel === "skill",
  };
}

function makeRequest(intent: string): ConnectorRequest {
  return {
    platformId: "evomap",
    intent: intent as ConnectorRequest["intent"],
    payload: {},
    decisionId: "dec-1",
    intentId: "intent-1",
    idempotencyKey: `idem-${intent}`,
  };
}

test("T-CS.C.10-A: agent.register via a2a saves node_secret", async () => {
  let savedSecret: string | null = null;
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return savedSecret; },
    async saveNodeSecret(_platformId, nodeSecret) { savedSecret = nodeSecret; },
  };

  const a2aClient: EvoMapA2AClient = {
    async helloOrRegister() {
      return { your_node_id: "node-123", node_secret: "secret-abc" };
    },
    async discoverWork() { throw new Error("unexpected"); },
  };

  const runner = createEvoMapRunner({ apiClient: { async heartbeat() { throw new Error("unexpected"); }, async claimTask() { throw new Error("unexpected"); } }, a2aClient, secretPort });
  const result = await runner.run(makePlan("agent.register", "a2a"), makeRequest("agent.register"));

  assert.equal(result.success, true);
  assert.equal(savedSecret, "secret-abc");
});

test("T-CS.C.10-B: agent.heartbeat via api_rest with node_secret", async () => {
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return "secret-xyz"; },
    async saveNodeSecret() {},
  };

  let heartbeatPayload: Record<string, unknown> | null = null;
  let heartbeatSecret: string | null = null;
  const apiClient: EvoMapApiClient = {
    async heartbeat(payload, nodeSecret) {
      heartbeatPayload = payload;
      heartbeatSecret = nodeSecret;
      return { status: "ok", timestamp: "2026-05-29T00:00:00Z" };
    },
    async claimTask() { throw new Error("unexpected"); },
  };

  const runner = createEvoMapRunner({ apiClient, a2aClient: { async helloOrRegister() { throw new Error("unexpected"); }, async discoverWork() { throw new Error("unexpected"); } }, secretPort });
  const result = await runner.run(makePlan("agent.heartbeat", "api_rest"), makeRequest("agent.heartbeat"));

  assert.equal(result.success, true);
  assert.equal(heartbeatSecret, "secret-xyz");
});

test("T-CS.C.10-C: work.discover via a2a with node_secret", async () => {
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return "secret-discover"; },
    async saveNodeSecret() {},
  };

  let discoverSecret: string | null = null;
  const a2aClient: EvoMapA2AClient = {
    async helloOrRegister() { throw new Error("unexpected"); },
    async discoverWork(_payload, nodeSecret) {
      discoverSecret = nodeSecret;
      return { tasks: [{ id: "task-1" }] };
    },
  };

  const runner = createEvoMapRunner({ apiClient: { async heartbeat() { throw new Error("unexpected"); }, async claimTask() { throw new Error("unexpected"); } }, a2aClient, secretPort });
  const result = await runner.run(makePlan("work.discover", "a2a"), makeRequest("work.discover"));

  assert.equal(result.success, true);
  assert.equal(discoverSecret, "secret-discover");
});

test("T-CS.C.10-D: task.claim via api_rest with node_secret", async () => {
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return "secret-claim"; },
    async saveNodeSecret() {},
  };

  let claimSecret: string | null = null;
  const apiClient: EvoMapApiClient = {
    async heartbeat() { throw new Error("unexpected"); },
    async claimTask(_payload, nodeSecret) {
      claimSecret = nodeSecret;
      return { claimed: true, taskId: "task-99" };
    },
  };

  const runner = createEvoMapRunner({ apiClient, a2aClient: { async helloOrRegister() { throw new Error("unexpected"); }, async discoverWork() { throw new Error("unexpected"); } }, secretPort });
  const result = await runner.run(makePlan("task.claim", "api_rest"), makeRequest("task.claim"));

  assert.equal(result.success, true);
  assert.equal(claimSecret, "secret-claim");
});

test("T-CS.C.10-E: missing node_secret throws verification_required", async () => {
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return null; },
    async saveNodeSecret() {},
  };

  const runner = createEvoMapRunner({
    apiClient: { async heartbeat() { throw new Error("unexpected"); }, async claimTask() { throw new Error("unexpected"); } },
    a2aClient: { async helloOrRegister() { throw new Error("unexpected"); }, async discoverWork() { throw new Error("unexpected"); } },
    secretPort,
  });

  const result = await runner.run(makePlan("agent.heartbeat", "api_rest"), makeRequest("agent.heartbeat"));
  assert.equal(result.success, false);
  const error = result.error as { code: string; detail: string };
  assert.equal(error.code, "verification_required");
  assert.equal(error.detail, "node_secret_required");
});

test("T-CS.C.10-F: unsupported intent throws protocol_mismatch", async () => {
  const secretPort: EvoMapSecretPort = {
    async loadNodeSecret() { return "secret"; },
    async saveNodeSecret() {},
  };

  const runner = createEvoMapRunner({
    apiClient: { async heartbeat() { throw new Error("unexpected"); }, async claimTask() { throw new Error("unexpected"); } },
    a2aClient: { async helloOrRegister() { throw new Error("unexpected"); }, async discoverWork() { throw new Error("unexpected"); } },
    secretPort,
  });

  const result = await runner.run(makePlan("feed.read", "api_rest"), { ...makeRequest("feed.read"), platformId: "evomap" });
  assert.equal(result.success, false);
  const error = result.error as { code: string; detail: string };
  assert.equal(error.code, "protocol_mismatch");
});
