/**
 * Connector Replay Cooldown — Integration Test (T-CS.R.3)
 *
 * Validates: connector policy layer blocks replay when cooldown is active,
 * and records cooldown_blocked failure class instead of hammering the platform.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  CapabilityContractRegistry,
  ChannelHealthStore,
  ConnectorRoutePlanner,
  createConnectorPolicyLayer,
  type CapabilityIntent,
  type ConnectorRequest,
  type RouteContextPort,
} from "../../../src/connectors/base/index.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";

function makeRouteContext(): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: "active" as const,
        credentialType: "api_key",
        encryptedValue: "api-key",
      };
    },
    async loadCooldownState() {
      return { blocked: false };
    },
  };
}

function makeRequest(intent: CapabilityIntent, overrides: Partial<ConnectorRequest> = {}): ConnectorRequest {
  return {
    platformId: "moltbook",
    intent,
    payload: {},
    decisionId: "dec_001",
    intentId: "int_001",
    idempotencyKey: "idemp_001",
    ...overrides,
  };
}

describe("connector-replay-cooldown", () => {
  it("blocks replay after repeated terminal failures", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = new CapabilityContractRegistry();
      registry.register({
        platformId: "moltbook",
        supportedCapabilities: ["feed.read"],
        channelPriority: ["api_rest"],
        credentialTypes: ["api_key"],
      });

      const cooldownPort = createConnectorCooldownPort(db);
      const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
      let callCount = 0;
      const policy = createConnectorPolicyLayer({
        routePlanner,
        cooldownPort,
        retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
        executionRunner: {
          async run(plan) {
            callCount += 1;
            return {
              platformId: "moltbook",
              channel: plan.channel,
              latencyMs: 10,
              success: false,
              error: { code: "api_error", status: 401, detail: "Unauthorized" },
            };
          },
        },
      });

      // Two executions with terminal auth_failure accumulate cooldown count to threshold
      const r1 = await policy.executeWithPolicy("feed.read", makeRequest("feed.read"));
      assert.equal(r1.status, "terminal_failure");
      assert.equal(r1.failureClass, "auth_failure");

      const r2 = await policy.executeWithPolicy("feed.read", makeRequest("feed.read"));
      assert.equal(r2.status, "terminal_failure");
      assert.equal(r2.failureClass, "auth_failure");

      // Third execution should be blocked by cooldown before reaching runner
      const r3 = await policy.executeWithPolicy("feed.read", makeRequest("feed.read"));
      assert.equal(r3.status, "terminal_failure");
      assert.equal(r3.failureClass, "cooldown_blocked");
      assert.equal(callCount, 2, "runner should not be called while cooldown active");
    } finally {
      db.close();
    }
  });
});
