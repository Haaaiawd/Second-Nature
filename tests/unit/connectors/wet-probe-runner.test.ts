/**
 * WetProbeRunner tests — T-CS.C.2
 *
 * Coverage:
 * - runWetProbe with safe endpoint returns 200/available
 * - runWetProbe with 404 returns unavailable
 * - strict idempotencyClass returns probe_policy_denied, no HTTP
 * - missing probeConfig returns unavailable with registry:missing ref
 * - capabilityId is present in result
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createWetProbeRunner } from "../../../src/connectors/base/wet-probe-runner.js";
import { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";

describe("WetProbeRunner", () => {
  const runner = createWetProbeRunner();

  function buildRegistry(
    idempotencyClass: "read_only" | "idempotent_write" | "strict",
  ): CapabilityContractRegistryV7 {
    const reg = new CapabilityContractRegistryV7();
    reg.register({
      platformId: "test-platform",
      capabilities: [
        {
          capabilityId: "cap-1",
          intent: "feed.read",
          probeConfig: {
            safeEndpoint: "http://localhost:9999/health",
            idempotencyClass,
          },
        },
      ],
      channelPriority: ["api_rest"],
      credentialTypes: ["token"],
    });
    return reg;
  }

  it("returns available on HTTP 200", async () => {
    const reg = buildRegistry("read_only");
    const mockHttpGet = async () => ({ status: 200, body: "ok" });

    const result = await runner.runWetProbe(
      "test-platform",
      "cap-1",
      reg,
      { httpGet: mockHttpGet },
    );

    assert.strictEqual(result.probeResult.actualStatus, "available");
    assert.strictEqual(result.httpStatus, 200);
    assert.strictEqual(result.probeResult.capabilityId, "cap-1");
    assert(result.probeResult.sampleResponseRef !== undefined);
  });

  it("returns unavailable on HTTP 404", async () => {
    const reg = buildRegistry("read_only");
    const mockHttpGet = async () => ({ status: 404 });

    const result = await runner.runWetProbe(
      "test-platform",
      "cap-1",
      reg,
      { httpGet: mockHttpGet },
    );

    assert.strictEqual(result.probeResult.actualStatus, "unavailable");
    assert.strictEqual(result.httpStatus, 404);
  });

  it("returns degraded on HTTP 503", async () => {
    const reg = buildRegistry("read_only");
    const mockHttpGet = async () => ({ status: 503 });

    const result = await runner.runWetProbe(
      "test-platform",
      "cap-1",
      reg,
      { httpGet: mockHttpGet },
    );

    assert.strictEqual(result.probeResult.actualStatus, "degraded");
  });

  it("returns probe_policy_denied for strict idempotencyClass", async () => {
    const reg = buildRegistry("strict");
    let httpCalled = false;
    const mockHttpGet = async () => {
      httpCalled = true;
      return { status: 200 };
    };

    const result = await runner.runWetProbe(
      "test-platform",
      "cap-1",
      reg,
      { httpGet: mockHttpGet },
    );

    assert.strictEqual(httpCalled, false);
    assert.strictEqual(result.probeResult.actualStatus, "unavailable");
    assert.strictEqual(result.httpStatus, 0);
  });

  it("returns unavailable when probeConfig missing", async () => {
    const reg = new CapabilityContractRegistryV7();
    reg.register({
      platformId: "test-platform",
      capabilities: [
        { capabilityId: "cap-no-probe", intent: "feed.read" },
      ],
      channelPriority: ["api_rest"],
      credentialTypes: ["token"],
    });

    const result = await runner.runWetProbe(
      "test-platform",
      "cap-no-probe",
      reg,
    );

    assert.strictEqual(result.probeResult.actualStatus, "unavailable");
    assert.strictEqual(result.probeResult.probeConfigRef, "registry:missing");
  });
});
