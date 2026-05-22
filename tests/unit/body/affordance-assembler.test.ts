/**
 * AffordanceAssembler tests — T-BTS.C.1
 *
 * Coverage:
 * - assembleAffordanceMap builds platform→capability map from registry + probes
 * - probe available → safe; degraded → exploratory; unavailable → unavailable
 * - no probe + credential required → needs_auth
 * - no probe + no credential required → unavailable
 * - cache hit on second call with same scope
 * - invalidateCache causes rebuild
 * - P95 < 1s for 50 manifests (smoke)
 * - contextScope filtering applied (platformIds, allowedStatuses)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createAffordanceAssembler } from "../../../src/core/second-nature/body/tool-affordance/affordance-assembler.js";
import { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";
import type {
  AffordanceContextScope,
  ProbeActualStatus,
} from "../../../src/shared/types/v7-entities.js";

function buildRegistry(capCount: number): CapabilityContractRegistryV7 {
  const reg = new CapabilityContractRegistryV7();
  for (let p = 0; p < capCount; p++) {
    reg.register({
      platformId: `platform-${p}`,
      capabilities: [
        {
          capabilityId: `cap-${p}-read`,
          intent: "feed.read",
          probeConfig: {
            safeEndpoint: `http://localhost:${9000 + p}/health`,
            idempotencyClass: "read_only",
          },
        },
        {
          capabilityId: `cap-${p}-write`,
          intent: "post.publish",
          probeConfig: {
            safeEndpoint: `http://localhost:${9000 + p}/post`,
            idempotencyClass: "idempotent_write",
          },
        },
      ],
      channelPriority: ["api_rest"],
      credentialTypes: ["token"],
    });
  }
  return reg;
}

function buildProbeReader(
  overrides: Record<string, ProbeActualStatus>,
): Parameters<typeof createAffordanceAssembler>[0]["probeReader"] {
  return {
    getLatestProbeResult(platformId: string, capabilityId: string) {
      const key = `${platformId}:${capabilityId}`;
      const status = overrides[key];
      if (!status) return undefined;
      return {
        actualStatus: status,
        createdAt: new Date().toISOString(),
      };
    },
  };
}

describe("AffordanceAssembler", () => {
  it("maps available probe to safe", async () => {
    const reg = buildRegistry(1);
    const reader = buildProbeReader({
      "platform-0:cap-0-read": "available",
    });
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const map = await assembler.assembleAffordanceMap();
    const items = map["platform-0"] ?? [];
    const readItem = items.find((i) => i.capabilityId === "cap-0-read");
    assert.strictEqual(readItem!.status, "safe");
  });

  it("maps degraded probe to exploratory", async () => {
    const reg = buildRegistry(1);
    const reader = buildProbeReader({
      "platform-0:cap-0-write": "degraded",
    });
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const map = await assembler.assembleAffordanceMap();
    const items = map["platform-0"] ?? [];
    const writeItem = items.find((i) => i.capabilityId === "cap-0-write");
    assert.strictEqual(writeItem!.status, "exploratory");
  });

  it("maps unavailable probe to unavailable (filtered out by default scope)", async () => {
    const reg = buildRegistry(1);
    const reader = buildProbeReader({
      "platform-0:cap-0-read": "unavailable",
    });
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const map = await assembler.assembleAffordanceMap();
    // unavailable is filtered by default scope
    assert.strictEqual(map["platform-0"], undefined);
  });

  it("no probe + credential required → needs_auth", async () => {
    const reg = buildRegistry(1);
    const reader = buildProbeReader({});
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    // Default scope filters out needs_auth, so use custom scope
    const map = await assembler.assembleAffordanceMap({
      allowedStatuses: ["safe", "exploratory", "needs_auth"],
    });
    const items = map["platform-0"] ?? [];
    assert(items.length > 0);
    assert(items.every((i) => i.status === "needs_auth"));
  });

  it("no probe + no credential required → unavailable", async () => {
    const reg = buildRegistry(1);
    const reader = buildProbeReader({});
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => false,
    });

    const map = await assembler.assembleAffordanceMap();
    const items = map["platform-0"] ?? [];
    // unavailable is filtered by default scope, so platform-0 should not appear
    assert.strictEqual(items.length, 0);
    // Verify with custom scope that includes unavailable
    const fullMap = await assembler.assembleAffordanceMap({
      allowedStatuses: ["safe", "exploratory", "needs_auth", "unavailable"],
    });
    const fullItems = fullMap["platform-0"] ?? [];
    assert(fullItems.every((i) => i.status === "unavailable"));
  });

  it("caches results and returns cached on second call", async () => {
    const reg = buildRegistry(1);
    let callCount = 0;
    const reader = {
      getLatestProbeResult() {
        callCount++;
        return {
          actualStatus: "available" as ProbeActualStatus,
          createdAt: new Date().toISOString(),
        };
      },
    };
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
      ttlMs: 60_000,
    });

    await assembler.assembleAffordanceMap();
    const firstCount = callCount;
    await assembler.assembleAffordanceMap();
    assert.strictEqual(callCount, firstCount); // no extra probe calls
  });

  it("invalidateCache causes rebuild", async () => {
    const reg = buildRegistry(1);
    let callCount = 0;
    const reader = {
      getLatestProbeResult() {
        callCount++;
        return {
          actualStatus: "available" as ProbeActualStatus,
          createdAt: new Date().toISOString(),
        };
      },
    };
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
      ttlMs: 60_000,
    });

    await assembler.assembleAffordanceMap();
    const firstCount = callCount;
    assembler.invalidateCache();
    await assembler.assembleAffordanceMap();
    assert.strictEqual(callCount, firstCount + 2); // 2 capabilities
  });

  it("P95 < 1s for 50 manifests", async () => {
    const reg = buildRegistry(50);
    const reader = buildProbeReader({});
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const start = performance.now();
    await assembler.assembleAffordanceMap();
    const elapsed = performance.now() - start;
    assert(
      elapsed < 1000,
      `assembleAffordanceMap took ${elapsed}ms, exceeds 1s P95 target`,
    );
  });

  it("contextScope.platformIds filters output", async () => {
    const reg = buildRegistry(3);
    const reader = buildProbeReader({
      "platform-1:cap-1-read": "available",
    });
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const map = await assembler.assembleAffordanceMap({
      platformIds: ["platform-1"],
    });
    assert.deepStrictEqual(Object.keys(map), ["platform-1"]);
  });

  it("contextScope.allowedStatuses custom filter", async () => {
    const reg = buildRegistry(2);
    const reader = buildProbeReader({
      "platform-0:cap-0-read": "available",
      "platform-0:cap-0-write": "degraded",
      "platform-1:cap-1-read": "available",
    });
    const assembler = createAffordanceAssembler({
      registry: reg,
      probeReader: reader,
      credentialRequired: () => true,
    });

    const map = await assembler.assembleAffordanceMap({
      allowedStatuses: ["safe"],
    });
    for (const items of Object.values(map)) {
      for (const item of items) {
        assert.strictEqual(item.status, "safe");
      }
    }
  });
});
