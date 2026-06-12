/**
 * Connector Failure Truth — API Tests (T-CS.R.2)
 *
 * Validates: connector policy layer surfaces actionable failure classes
 * instead of defaulting to unknown_platform_change for known HTTP/auth/config
 * errors, and does not leak raw credentials in metadata.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  CapabilityContractRegistry,
  ChannelHealthStore,
  ConnectorRoutePlanner,
  createConnectorPolicyLayer,
  type CapabilityIntent,
  type ConnectorRequest,
  type RouteContextPort,
} from "../../../src/connectors/base/index.js";

function makeRouteContext(credentialState: "active" | "missing" = "active"): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: credentialState,
        credentialType: "api_key",
        encryptedValue: credentialState === "active" ? "api-key" : undefined,
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

describe("connector-failure-truth API", () => {
  function makePolicyLayer(error: unknown, credentialState: "active" | "missing" = "active") {
    const registry = new CapabilityContractRegistry();
    registry.register({
      platformId: "moltbook",
      supportedCapabilities: ["feed.read"],
      channelPriority: ["api_rest"],
      credentialTypes: ["api_key"],
    });
    const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(credentialState), new ChannelHealthStore());
    return createConnectorPolicyLayer({
      routePlanner,
      retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
      executionRunner: {
        async run(plan) {
          return {
            platformId: "moltbook",
            channel: plan.channel,
            latencyMs: 10,
            success: false,
            error,
          };
        },
      },
    });
  }

  it("classifies 401 as auth_failure", async () => {
    const layer = makePolicyLayer({ code: "api_error", status: 401, detail: "Unauthorized" });
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "auth_failure");
    assert.ok(!result.metadata.detail?.includes("api-key"), "no credential leak");
  });

  it("classifies 404 as permanent_input_error", async () => {
    const layer = makePolicyLayer({ code: "api_error", status: 404, detail: "Not found" });
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "permanent_input_error");
  });

  it("classifies 429 as rate_limited", async () => {
    const layer = makePolicyLayer({ code: "api_error", status: 429, detail: "Too many requests", retryAfterSeconds: 120 });
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "rate_limited");
    assert.equal(result.retryAfterMs, 120000);
  });

  it("classifies 503 as transport_failure", async () => {
    const layer = makePolicyLayer({ code: "api_error", status: 503, detail: "Unavailable" });
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "transport_failure");
  });

  it("classifies configuration_missing", async () => {
    const layer = makePolicyLayer({ code: "configuration_missing", detail: "base url missing" });
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "configuration_missing");
  });

  it("classifies MoltbookApiError-like statusCode", async () => {
    class MockMoltbookError extends Error {
      constructor(public readonly statusCode: number, message: string) {
        super(message);
      }
    }
    const layer = makePolicyLayer(new MockMoltbookError(422, "bad request"));
    const result = await layer.executeWithPolicy("feed.read", makeRequest("feed.read"));
    assert.equal(result.status, "terminal_failure");
    if (result.status !== "terminal_failure") return;
    assert.equal(result.failureClass, "permanent_input_error");
  });
});
