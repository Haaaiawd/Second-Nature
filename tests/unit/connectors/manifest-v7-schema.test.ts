/**
 * T-CS.C.1 — CapabilityContractRegistry v7 扩展单元测试
 *
 * Verification types (05A / 05B):
 * - 单元测试: v7 manifest schema 扩展；capabilityId 存在；严格 Zod 校验
 *
 * Dependencies: `src/connectors/base/manifest-v7.ts`
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  validateManifestV7,
  CapabilityContractRegistryV7,
  type ConnectorManifestV7,
} from "../../../src/connectors/base/manifest-v7.js";

function buildValidManifest(): ConnectorManifestV7 {
  return {
    platformId: "moltbook",
    capabilities: [
      {
        capabilityId: "moltbook:feed.read",
        intent: "feed.read",
        description: "Read user feed",
        probeConfig: {
          safeEndpoint: "https://api.moltbook.com/v1/feed",
          idempotencyClass: "read_only",
        },
        endpointMappings: {
          profilePath: "/api/v1/profile",
          claimPath: "/api/v1/claims",
          heartbeatPath: "/api/v1/heartbeat",
        },
      },
    ],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
  };
}

describe("validateManifestV7 — schema strictness", () => {
  it("accepts valid v7 manifest with probeConfig and endpointMappings", () => {
    const result = validateManifestV7(buildValidManifest());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.manifest);
    assert.strictEqual(result.manifest!.capabilities[0]!.capabilityId, "moltbook:feed.read");
  });

  it("accepts manifest without optional probeConfig/endpointMappings", () => {
    const manifest = buildValidManifest();
    delete (manifest.capabilities[0] as Record<string, unknown>).probeConfig;
    delete (manifest.capabilities[0] as Record<string, unknown>).endpointMappings;
    const result = validateManifestV7(manifest);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("rejects manifest with empty platformId", () => {
    const result = validateManifestV7({
      ...buildValidManifest(),
      platformId: "",
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("platformId")));
  });

  it("rejects manifest with empty capabilities array", () => {
    const result = validateManifestV7({
      ...buildValidManifest(),
      capabilities: [],
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("capabilities")));
  });

  it("rejects manifest with invalid idempotencyClass", () => {
    const manifest = buildValidManifest();
    (manifest.capabilities[0] as Record<string, unknown>).probeConfig = {
      safeEndpoint: "https://example.com",
      idempotencyClass: "invalid",
    };
    const result = validateManifestV7(manifest);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("idempotencyClass")));
  });
});

describe("CapabilityContractRegistryV7 — register", () => {
  it("registers valid manifest and returns ok", () => {
    const registry = new CapabilityContractRegistryV7();
    const result = registry.register(buildValidManifest());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("returns specific error when capabilityId is missing (DR-001)", () => {
    const registry = new CapabilityContractRegistryV7();
    const manifest = buildValidManifest();
    (manifest.capabilities[0] as Record<string, unknown>).capabilityId = "";
    const result = registry.register(manifest);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) =>
        e.includes("capabilityId missing") || e.includes("capabilityId"),
      ),
    );
  });

  it("returns structured validation errors for invalid input", () => {
    const registry = new CapabilityContractRegistryV7();
    const result = registry.register({ invalid: true });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length > 0);
  });

  it("does not throw on invalid input", () => {
    const registry = new CapabilityContractRegistryV7();
    assert.doesNotThrow(() => {
      registry.register({ invalid: true });
    });
  });
});

describe("CapabilityContractRegistryV7 — resolveCapability", () => {
  it("resolves qualified capabilityId (platformId:capabilityId)", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const resolved = registry.resolveCapability("moltbook:moltbook:feed.read");
    assert.ok(resolved);
    assert.strictEqual(resolved!.capabilityId, "moltbook:feed.read");
    assert.strictEqual(resolved!.intent, "feed.read");
  });

  it("resolves unqualified capabilityId by search", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const resolved = registry.resolveCapability("feed.read");
    assert.ok(resolved);
    assert.strictEqual(resolved!.platformId, "moltbook");
    assert.strictEqual(resolved!.capabilityId, "moltbook:feed.read");
  });

  it("returns undefined for unknown capabilityId", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const resolved = registry.resolveCapability("unknown:cap");
    assert.strictEqual(resolved, undefined);
  });

  it("returns probeConfig from capability-level override", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const config = registry.getProbeConfig("moltbook", "moltbook:feed.read");
    assert.ok(config);
    assert.strictEqual(config!.safeEndpoint, "https://api.moltbook.com/v1/feed");
    assert.strictEqual(config!.idempotencyClass, "read_only");
  });

  it("returns endpointMappings from capability-level", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const mappings = registry.getEndpointMappings("moltbook", "moltbook:feed.read");
    assert.ok(mappings);
    assert.strictEqual(mappings!.profilePath, "/api/v1/profile");
  });
});

describe("CapabilityContractRegistryV7 — hasCapability / listCapabilities", () => {
  it("hasCapability returns true for registered capability", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    assert.strictEqual(registry.hasCapability("moltbook", "moltbook:feed.read"), true);
  });

  it("hasCapability returns false for unknown capability", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    assert.strictEqual(registry.hasCapability("moltbook", "unknown"), false);
  });

  it("listCapabilities returns all capabilities with flags", () => {
    const registry = new CapabilityContractRegistryV7();
    registry.register(buildValidManifest());
    const list = registry.listCapabilities("moltbook");
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0]!.capabilityId, "moltbook:feed.read");
    assert.strictEqual(list[0]!.hasProbeConfig, true);
    assert.strictEqual(list[0]!.hasEndpointMappings, true);
  });
});
