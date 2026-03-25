import test from "node:test";
import assert from "node:assert/strict";

import {
  CapabilityContractRegistry,
  ConnectorRoutePlanner,
  ChannelHealthStore,
  ConnectorPolicyError,
  classifyFailure,
  createConnectorContractCore,
  type RouteContextPort,
  type CapabilityIntent,
  type ChannelType,
} from "../../../src/connectors/base/index.js";

function makeRouteContext(overrides?: {
  credentialState?: "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed";
  cooldownBlocked?: boolean;
}): RouteContextPort {
  const credentialState = overrides?.credentialState ?? "active";
  const cooldownBlocked = overrides?.cooldownBlocked ?? false;

  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: credentialState,
        credentialType: "api_key",
      };
    },
    async loadCooldownState() {
      return {
        blocked: cooldownBlocked,
        retryAfterMs: cooldownBlocked ? 30000 : undefined,
      };
    },
  };
}

function registerManifest(registry: CapabilityContractRegistry, channelPriority: ChannelType[] = ["api_rest", "cli", "skill"]) {
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["feed.read", "post.publish", "comment.reply", "message.send"],
    channelPriority,
    credentialTypes: ["api_key"],
    degradedChannels: ["cli", "skill", "browser"],
  });
}

test("manifest registry validates capability/channel and supports capability lookup", () => {
  const registry = new CapabilityContractRegistry();
  registerManifest(registry);

  assert.equal(registry.hasCapability("instreet", "feed.read"), true);
  assert.equal(registry.hasCapability("instreet", "task.claim" as CapabilityIntent), false);

  assert.throws(
    () =>
      registry.register({
        platformId: "bad-platform",
        supportedCapabilities: ["feed.read"],
        channelPriority: [] as ChannelType[],
        credentialTypes: ["api_key"],
      }),
    /too_small/
  );
});

test("failure taxonomy classifies rate-limit and verification errors uniformly", () => {
  const rateLimited = classifyFailure({ status: 429, retryAfterSeconds: 7 });
  assert.equal(rateLimited.class, "rate_limited");
  assert.equal(rateLimited.retryable, true);
  assert.equal(rateLimited.retryAfterMs, 7000);

  const verification = classifyFailure({ code: "verification_required" });
  assert.equal(verification.class, "verification_required");
  assert.equal(verification.retryable, false);
});

test("route planner applies API-first, pending_verification fallback and cooldown block", async () => {
  const registry = new CapabilityContractRegistry();
  registerManifest(registry, ["api_rest", "cli", "skill"]);

  const health = new ChannelHealthStore();
  const activePlanner = new ConnectorRoutePlanner(registry, makeRouteContext({ credentialState: "active" }), health);
  const activePlan = await activePlanner.planRoute("feed.read", {
    platformId: "instreet",
    intent: "feed.read",
    payload: {},
  });
  assert.equal(activePlan.channel, "api_rest");

  const pendingPlanner = new ConnectorRoutePlanner(
    registry,
    makeRouteContext({ credentialState: "pending_verification" }),
    health
  );
  const pendingPlan = await pendingPlanner.planRoute("feed.read", {
    platformId: "instreet",
    intent: "feed.read",
    payload: {},
  });
  assert.equal(pendingPlan.channel, "skill");

  const blockedPlanner = new ConnectorRoutePlanner(registry, makeRouteContext({ cooldownBlocked: true }), health);
  await assert.rejects(
    () =>
      blockedPlanner.planRoute("feed.read", {
        platformId: "instreet",
        intent: "feed.read",
        payload: {},
      }),
    /cooldown_blocked/
  );
});

test("route planner uses manifest.degradedChannels semantics for side-effect safety", async () => {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "instreet",
    supportedCapabilities: ["post.publish", "feed.read"],
    channelPriority: ["api_rest", "cli"],
    credentialTypes: ["api_key"],
    degradedChannels: ["api_rest"],
  });

  const planner = new ConnectorRoutePlanner(registry, makeRouteContext({ credentialState: "active" }), new ChannelHealthStore());
  await assert.rejects(
    () =>
      planner.planRoute("post.publish", {
        platformId: "instreet",
        intent: "post.publish",
        payload: {},
      }),
    /degraded_channel_not_allowed_for_side_effect/
  );
});

test("contract core enforces capability contract and returns normalized result", async () => {
  const registry = new CapabilityContractRegistry();
  registerManifest(registry, ["api_rest", "cli"]);

  const planner = new ConnectorRoutePlanner(registry, makeRouteContext({ credentialState: "active" }), new ChannelHealthStore());

  const contract = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner: planner,
    executionRunner: {
      async run(plan) {
        return {
          platformId: plan.platformId,
          channel: plan.channel,
          latencyMs: 12,
          success: false,
          error: { status: 429, retryAfterSeconds: 1 },
        };
      },
    },
  });

  const result = await contract.executeCapability("feed.read", {
    platformId: "instreet",
    intent: "feed.read",
    payload: {},
  });

  assert.equal(result.status, "retryable_failure");
  assert.equal(result.failureClass, "rate_limited");
  assert.equal(result.retryAfterMs, 1000);
  assert.equal(result.metadata.channel, "api_rest");
});

test("unsupported capability is treated as protocol mismatch, not skipped", async () => {
  const registry = new CapabilityContractRegistry();
  registerManifest(registry, ["api_rest", "cli"]);

  const planner = new ConnectorRoutePlanner(registry, makeRouteContext({ credentialState: "active" }), new ChannelHealthStore());

  const contract = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner: planner,
    executionRunner: {
      async run() {
        throw new Error("should_not_run");
      },
    },
  });

  await assert.rejects(
    () =>
      contract.executeCapability("task.claim", {
        platformId: "instreet",
        intent: "task.claim",
        payload: {},
      }),
    /capability_not_supported_by_manifest/
  );
});

test("contract core forwards route planner plan object without rebuilding", async () => {
  const registry = new CapabilityContractRegistry();
  registerManifest(registry, ["api_rest", "cli"]);

  const capturedPlans: Array<{ endpointMode: string; channel: string }> = [];
  const contract = createConnectorContractCore({
    manifestLoader: registry,
    routePlanner: {
      async planRoute() {
        return {
          platformId: "instreet",
          intent: "feed.read",
          channel: "cli",
          endpointMode: "skill_call",
          idempotencyKey: "id-1",
        };
      },
    },
    executionRunner: {
      async run(plan) {
        capturedPlans.push({ endpointMode: plan.endpointMode, channel: plan.channel });
        return {
          platformId: plan.platformId,
          channel: plan.channel,
          latencyMs: 5,
          success: true,
          payload: { ok: true },
        };
      },
    },
  });

  const result = await contract.executeCapability("feed.read", {
    platformId: "instreet",
    intent: "feed.read",
    payload: {},
  });

  assert.equal(result.status, "success");
  assert.equal(capturedPlans.length, 1);
  assert.deepEqual(capturedPlans[0], { endpointMode: "skill_call", channel: "cli" });
});

test("failure taxonomy keeps same retryability for same class across branches", () => {
  const fromPolicy = classifyFailure(new ConnectorPolicyError("concurrency_conflict", "conflict"));
  const fromObject = classifyFailure({ code: "concurrency_conflict" });

  assert.equal(fromPolicy.class, "concurrency_conflict");
  assert.equal(fromObject.class, "concurrency_conflict");
  assert.equal(fromPolicy.retryable, fromObject.retryable);
  assert.equal(fromPolicy.retryable, true);
});
