import test from "node:test";
import assert from "node:assert/strict";

import { createObservabilityDatabase, ExecutionTelemetry, obsSchema } from "../../../src/observability/index.js";
import {
  CapabilityContractRegistry,
  ChannelHealthStore,
  ConnectorRoutePlanner,
  createConnectorPolicyLayer,
  type CapabilityIntent,
  type ConnectorRequest,
  type RouteContextPort,
} from "../../../src/connectors/base/index.js";

function makeRouteContext(credentialState: "active" | "pending_verification" = "active"): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: credentialState,
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
    platformId: "instreet",
    intent,
    payload: {},
    decisionId: "decision-1",
    intentId: "intent-1",
    ...overrides,
  };
}

test("policy layer records telemetry and applies single-layer retry for InStreet 429 retry_after_seconds", async () => {
  const db = createObservabilityDatabase(":memory:");
  db.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS execution_attempts (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      decision_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      commit_state TEXT,
      failure_class TEXT,
      retry_policy TEXT,
      idempotency_key TEXT,
      started_at TEXT,
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS redaction_manifest (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      action TEXT NOT NULL,
      original_value_hash TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["notification.list"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
  });
  const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
  const telemetry = new ExecutionTelemetry(db);

  let count = 0;
  const policy = createConnectorPolicyLayer({
    routePlanner,
    telemetry,
    retryPolicy: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    executionRunner: {
      async run(plan) {
        count += 1;
        if (count === 1) {
          return {
            platformId: "instreet",
            channel: plan.channel,
            latencyMs: 3,
            success: false,
            error: { status: 429, retryAfterSeconds: 0.001 },
          };
        }
        return {
          platformId: "instreet",
          channel: plan.channel,
          latencyMs: 2,
          success: true,
          payload: { ok: true },
        };
      },
    },
  });

  const result = await policy.executeWithPolicy("notification.list", makeRequest("notification.list"));
  assert.equal(result.status, "success");
  assert.equal(count, 2);

  const attempts = await db.db.select().from(obsSchema.executionAttempts);
  assert.equal(attempts.length, 2);
  assert.ok(attempts.some((row) => row.status === "failed"));
  assert.ok(attempts.some((row) => row.status === "succeeded"));
  assert.ok(attempts.every((row) => row.decisionId === "decision-1"));
  assert.ok(attempts.every((row) => row.intentId === "intent-1"));

  db.close();
});

test("policy layer classifies EvoMap protocol/auth errors without polluting base contract", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "evomap",
    supportedCapabilities: ["task.claim"],
    channelPriority: ["api_rest"],
    credentialTypes: ["node_secret"],
  });
  const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());

  const errors = [
    { code: "verification_required", detail: "node_secret_required", expected: "verification_required" },
    { code: "protocol_mismatch", detail: "bundle_required", expected: "protocol_mismatch" },
    { code: "protocol_mismatch", detail: "asset_id mismatch", expected: "protocol_mismatch" },
  ] as const;

  for (const entry of errors) {
    const policy = createConnectorPolicyLayer({
      routePlanner,
      retryPolicy: { maxRetries: 1, jitter: false, baseDelayMs: 1, maxDelayMs: 1 },
      executionRunner: {
        async run(plan) {
          return {
            platformId: "evomap",
            channel: plan.channel,
            latencyMs: 1,
            success: false,
            error: { code: entry.code, detail: entry.detail },
          };
        },
      },
    });

    const result = await policy.executeWithPolicy("task.claim", {
      platformId: "evomap",
      intent: "task.claim",
      payload: {},
      decisionId: "decision-evomap",
      intentId: "intent-evomap",
    });
    assert.equal(result.status, "terminal_failure");
    assert.equal(result.failureClass, entry.expected);
  }
});

test("policy layer blocks degraded fallback when not allowed and marks degraded metadata", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["notification.list"],
    channelPriority: ["skill"],
    credentialTypes: ["api_key"],
    degradedChannels: ["skill"],
  });
  const routePlanner = new ConnectorRoutePlanner(
    registry,
    makeRouteContext("pending_verification"),
    new ChannelHealthStore()
  );

  const blocked = createConnectorPolicyLayer({
    routePlanner,
    allowDegradedFallback: () => false,
    executionRunner: {
      async run() {
        throw new Error("should_not_execute");
      },
    },
  });

  const blockedResult = await blocked.executeWithPolicy("notification.list", makeRequest("notification.list"));
  assert.equal(blockedResult.status, "terminal_failure");
  assert.equal(blockedResult.failureClass, "protocol_mismatch");
  assert.equal(blockedResult.metadata.degraded, true);

  const allowed = createConnectorPolicyLayer({
    routePlanner,
    allowDegradedFallback: () => true,
    executionRunner: {
      async run(plan) {
        return {
          platformId: "instreet",
          channel: plan.channel,
          latencyMs: 1,
          degraded: true,
          success: true,
          payload: { ok: true },
        };
      },
    },
  });

  const allowedResult = await allowed.executeWithPolicy("notification.list", makeRequest("notification.list"));
  assert.equal(allowedResult.status, "success");
  assert.equal(allowedResult.metadata.degraded, true);
});

test("policy layer applies cooldown block before execution", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["notification.list"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
  });

  const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
  const policy = createConnectorPolicyLayer({
    routePlanner,
    cooldownPort: {
      async isBlocked() {
        return { blocked: true, retryAfterMs: 5000 };
      },
      async markFailure() {
        return;
      },
    },
    executionRunner: {
      async run() {
        throw new Error("should_not_execute");
      },
    },
  });

  const result = await policy.executeWithPolicy("notification.list", makeRequest("notification.list"));
  assert.equal(result.status, "terminal_failure");
  assert.equal(result.failureClass, "cooldown_blocked");
  assert.equal(result.retryAfterMs, 5000);
});

test("policy layer telemetry identity requires real decisionId and intentId", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["notification.list"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
  });

  const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
  const policy = createConnectorPolicyLayer({
    routePlanner,
    executionRunner: {
      async run(plan) {
        return {
          platformId: "instreet",
          channel: plan.channel,
          latencyMs: 1,
          success: true,
          payload: { ok: true },
        };
      },
    },
  });

  await assert.rejects(
    () =>
      policy.executeWithPolicy("notification.list", {
        platformId: "instreet",
        intent: "notification.list",
        payload: {},
      }),
    /connector_policy_missing_decision_or_intent_identity/
  );
});
