/**
 * T-ROS.C.3 — ManualRunDispatcher unit tests.
 *
 * Verifies:
 *   1. runConnector executes connector, records experience with triggerSource="manual_run"
 *   2. runConnector returns envelope with affectsHeartbeatCadence=false
 *   3. runWetProbe delegates to WetProbeRunner and annotates manual context
 *   4. runHeartbeatProbe delegates to heartbeatCheck and annotates manual context
 *   5. When connector fails, experience is still recorded with triggerSource="manual_run"
 *
 * Evidence: tests/unit/ops/manual-run-dispatcher.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createManualRunDispatcher,
  type ManualRunDispatcherDeps,
} from "../../../src/cli/ops/manual-run-dispatcher.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";
import type { ExperienceWriter } from "../../../src/core/second-nature/body/tool-experience/experience-writer.js";
import type { WetProbeRunner } from "../../../src/connectors/base/wet-probe-runner.js";
import type { CapabilityContractRegistryV7 } from "../../../src/connectors/base/manifest-v7.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";

// ─── mocks ──────────────────────────────────────────────────────────────────

function makeMockConnectorExecutor(result: ConnectorResult<unknown>) {
  return {
    async executeEffect() {
      return result;
    },
  };
}

function makeMockExperienceWriter() {
  const calls: Array<{
    connectorId: string;
    capabilityId: string;
    result: ConnectorResult<unknown>;
    triggerSource: string;
  }> = [];
  return {
    async recordExperience(input: {
      connectorId: string;
      capabilityId: string;
      result: ConnectorResult<unknown>;
      triggerSource: string;
    }) {
      calls.push(input);
    },
    calls,
  };
}

function makeMockWetProbeRunner(overrides?: {
  actualStatus?: string;
  httpStatus?: number;
}) {
  return {
    async runWetProbe() {
      return {
        probeResult: {
          probeResultId: "probe:test",
          capabilityId: "cap1",
          connectorId: "plat1",
          actualStatus: (overrides?.actualStatus ?? "available") as
            | "available"
            | "degraded"
            | "unavailable",
          probeConfigRef: "http://test",
          createdAt: new Date().toISOString(),
        },
        httpStatus: overrides?.httpStatus ?? 200,
      };
    },
  };
}

function makeMockRegistryV7(): CapabilityContractRegistryV7 {
  return {
    register() {
      return { ok: true, errors: [] };
    },
    loadManifest() {
      return undefined;
    },
    listRegisteredPlatformIds() {
      return [];
    },
    resolveCapability() {
      return undefined;
    },
  } as unknown as CapabilityContractRegistryV7;
}

// ─── tests ──────────────────────────────────────────────────────────────────

test("T-ROS.C.3 AC-1 — runConnector records experience with triggerSource=manual_run", async () => {
  const connectorResult: ConnectorResult<unknown> = {
    status: "success",
    data: { ok: true },
    metadata: { platformId: "plat1", channel: "api_rest", latencyMs: 42, degraded: false },
  };
  const mockExecutor = makeMockConnectorExecutor(connectorResult);
  const mockWriter = makeMockExperienceWriter();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: mockExecutor as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(deps);
  const envelope = await dispatcher.runConnector({
    platformId: "plat1",
    capabilityId: "cap1",
    payload: { foo: "bar" },
  });

  assert.equal(envelope.ok, true);
  assert.equal(envelope.data?.triggerSource, "manual_run");
  assert.equal(envelope.data?.affectsHeartbeatCadence, false);

  assert.equal(mockWriter.calls.length, 1);
  assert.equal(mockWriter.calls[0]!.triggerSource, "manual_run");
  assert.equal(mockWriter.calls[0]!.connectorId, "plat1");
  assert.equal(mockWriter.calls[0]!.capabilityId, "cap1");
});

test("T-OBS.R.1 — runConnector writes connector.attempt audit for heartbeat_digest", async () => {
  const connectorResult: ConnectorResult<unknown> = {
    status: "success",
    data: { ok: true, rawPayload: "should_not_be_aggregated" },
    metadata: { platformId: "plat1", channel: "api_rest", latencyMs: 42, degraded: false },
  };
  const mockExecutor = makeMockConnectorExecutor(connectorResult);
  const mockWriter = makeMockExperienceWriter();
  const auditStore = new AppendOnlyAuditStore();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: mockExecutor as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
    auditStore,
  };

  const dispatcher = createManualRunDispatcher(deps);
  await dispatcher.runConnector({
    platformId: "plat1",
    capabilityId: "feed.read",
  });

  const events = auditStore.list();
  assert.equal(events.length, 1);
  assert.equal(events[0]!.family, "connector.attempt");
  const payload = events[0]!.payload as Record<string, unknown>;
  assert.equal(payload.platformId, "plat1");
  assert.equal(payload.capability, "feed.read");
  assert.equal(payload.outcome, "success");
  assert.equal(payload.triggerSource, "manual_run");
  assert.equal("rawPayload" in payload, false);
});

test("T-ROS.C.3 AC-1 — runConnector records experience even on failure", async () => {
  const connectorResult: ConnectorResult<unknown> = {
    status: "terminal_failure",
    failureClass: "auth_failure",
    metadata: { platformId: "plat1", channel: "api_rest", latencyMs: 12, degraded: false },
  };
  const mockExecutor = makeMockConnectorExecutor(connectorResult);
  const mockWriter = makeMockExperienceWriter();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: mockExecutor as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(deps);
  const envelope = await dispatcher.runConnector({
    platformId: "plat1",
    capabilityId: "cap1",
  });

  assert.equal(envelope.ok, false);
  assert.equal(envelope.data?.triggerSource, "manual_run");
  assert.equal(envelope.data?.affectsHeartbeatCadence, false);

  assert.equal(mockWriter.calls.length, 1);
  assert.equal(mockWriter.calls[0]!.triggerSource, "manual_run");
});

test("T-ROS.C.3 AC-3 — runWetProbe returns manual_run triggerSource and cadence=false", async () => {
  const mockWriter = makeMockExperienceWriter();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: makeMockConnectorExecutor({
      status: "success",
      data: {},
      metadata: { platformId: "p", channel: "api_rest", latencyMs: 0, degraded: false },
    }) as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(deps);
  const envelope = await dispatcher.runWetProbe({
    platformId: "plat1",
    capabilityId: "cap1",
  });

  assert.equal(envelope.ok, true);
  assert.equal(envelope.data?.triggerSource, "manual_run");
  assert.equal(envelope.data?.affectsHeartbeatCadence, false);
});

test("T-ROS.C.3 AC-3 — runWetProbe returns ok:false when probe degraded", async () => {
  const mockWriter = makeMockExperienceWriter();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: makeMockConnectorExecutor({
      status: "success",
      data: {},
      metadata: { platformId: "p", channel: "api_rest", latencyMs: 0, degraded: false },
    }) as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner({
      actualStatus: "unavailable",
      httpStatus: 503,
    }) as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(deps);
  const envelope = await dispatcher.runWetProbe({
    platformId: "plat1",
    capabilityId: "cap1",
  });

  assert.equal(envelope.ok, false);
  assert.equal(envelope.data?.triggerSource, "manual_run");
  assert.equal(envelope.data?.affectsHeartbeatCadence, false);
});

test("T-ROS.C.3 AC-3 — runHeartbeatProbe annotates with manual_run context", async () => {
  const mockWriter = makeMockExperienceWriter();
  const deps: ManualRunDispatcherDeps = {
    connectorExecutor: makeMockConnectorExecutor({
      status: "success",
      data: {},
      metadata: { platformId: "p", channel: "api_rest", latencyMs: 0, degraded: false },
    }) as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(deps);
  const result = await dispatcher.runHeartbeatProbe({
    deps: {
      runtimeAvailable: false,
    },
    caller: "operator",
    reason: "manual_probe",
  });

  assert.equal(result.triggerSource, "manual_run");
  assert.equal(result.affectsHeartbeatCadence, false);
  assert.equal(result.caller, "operator");
  assert.equal(result.reason, "manual_probe");
});

test("T-ROS.C.3 — runConnector passes payload to connectorExecutor", async () => {
  const calls: Array<{
    platformId: string;
    intent: string;
    payload: Record<string, unknown>;
  }> = [];
  const executor = {
    async executeEffect(input: {
      platformId: string;
      intent: string;
      payload: Record<string, unknown>;
    }) {
      calls.push(input);
      return {
        status: "success" as const,
        data: {},
        metadata: { platformId: input.platformId, channel: "api_rest" as const, latencyMs: 10, degraded: false },
      };
    },
  };
  const mockWriter = makeMockExperienceWriter();
  const dispatcherDeps: ManualRunDispatcherDeps = {
    connectorExecutor: executor as unknown as ManualRunDispatcherDeps["connectorExecutor"],
    experienceWriter: mockWriter as unknown as ExperienceWriter,
    wetProbeRunner: makeMockWetProbeRunner() as unknown as WetProbeRunner,
    registryV7: makeMockRegistryV7(),
  };

  const dispatcher = createManualRunDispatcher(dispatcherDeps);
  await dispatcher.runConnector({
    platformId: "plat1",
    capabilityId: "feed.read",
    payload: { cursor: "abc" },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.platformId, "plat1");
  assert.equal(calls[0]!.intent, "feed.read");
  assert.deepStrictEqual(calls[0]!.payload, { cursor: "abc" });
});
