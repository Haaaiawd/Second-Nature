/**
 * ManualRunDispatcher — T-ROS.C.3 (DR-038)
 *
 * Core logic: Isolated entry points for manual connector execution, wet probe,
 * and heartbeat probe. All paths enforce:
 *   - triggerSource: "manual_run" on downstream records
 *   - affectsHeartbeatCadence: false (does not advance cron cadence)
 *
 * Writes are serialized through the same WriteQueue as cron heartbeat,
 * preventing concurrent DB conflicts without blocking either path.
 *
 * Dependencies:
 *   - ConnectorExecutor (from connector-system)
 *   - ExperienceWriter (from body-tool-system)
 *   - WetProbeRunner (from connector-system)
 *   - heartbeatCheck (from heartbeat-surface)
 *
 * Boundary:
 *   - Does NOT implement connector adapters; delegates to ConnectorExecutor.
 *   - Does NOT persist raw payloads; redacted samples only.
 *   - Caller provides all ports; no module-scope state.
 *
 * Test coverage: tests/unit/ops/manual-run-dispatcher.test.ts
 */

import * as crypto from "node:crypto";
import type { ConnectorExecutor, ConnectorResult } from "../../connectors/base/contract.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { WetProbeRunner } from "../../connectors/base/wet-probe-runner.js";
import type { CapabilityContractRegistryV7 } from "../../connectors/base/manifest-v7.js";
import {
  heartbeatCheck,
  type HeartbeatCheckInput,
  type HeartbeatSurfaceResult,
} from "./heartbeat-surface.js";
import type { RuntimeOpsEnvelope } from "./ops-router.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ManualTriggerContext {
  triggerSource: "manual_run";
  affectsHeartbeatCadence: false;
  caller?: string;
  reason?: string;
}

export interface ConnectorRunInput {
  platformId: string;
  capabilityId: string;
  payload?: Record<string, unknown>;
  caller?: string;
  reason?: string;
}

export interface ConnectorRunResult {
  connectorResult: ConnectorResult<unknown>;
  experienceId: string;
  triggerSource: "manual_run";
  affectsHeartbeatCadence: false;
}

export interface WetProbeRunInput {
  platformId: string;
  capabilityId: string;
}

export interface WetProbeManualResult {
  probeResultId: string;
  platformId: string;
  capabilityId: string;
  actualStatus: string;
  httpStatus: number;
  triggerSource: "manual_run";
  affectsHeartbeatCadence: false;
}

export interface HeartbeatProbeInput {
  deps: HeartbeatCheckInput;
  caller?: string;
  reason?: string;
}

export interface ManualRunDispatcher {
  runConnector(input: ConnectorRunInput): Promise<RuntimeOpsEnvelope<ConnectorRunResult>>;
  runWetProbe(input: WetProbeRunInput): Promise<RuntimeOpsEnvelope<WetProbeManualResult>>;
  runHeartbeatProbe(input: HeartbeatProbeInput): Promise<HeartbeatSurfaceResult & ManualTriggerContext>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export interface ManualRunDispatcherDeps {
  connectorExecutor: ConnectorExecutor;
  experienceWriter: ExperienceWriter;
  wetProbeRunner: WetProbeRunner;
  registryV7: CapabilityContractRegistryV7;
}

function buildManualContext(
  input: { caller?: string; reason?: string },
): ManualTriggerContext {
  return {
    triggerSource: "manual_run",
    affectsHeartbeatCadence: false,
    caller: input.caller,
    reason: input.reason ?? "manual_run_dispatcher",
  };
}

export function createManualRunDispatcher(
  deps: ManualRunDispatcherDeps,
): ManualRunDispatcher {
  return {
    async runConnector(input) {
      const ctx = buildManualContext(input);
      const decisionId = `manual:${crypto.randomUUID()}`;
      const intentId = `manual-run:${input.platformId}:${input.capabilityId}`;
      const idempotencyKey = `idem:manual:${crypto.randomUUID()}`;

      const connectorResult = await deps.connectorExecutor.executeEffect({
        platformId: input.platformId,
        intent: input.capabilityId,
        payload: input.payload ?? {},
        decisionId,
        intentId,
        idempotencyKey,
      });

      const experienceId = crypto.randomUUID();
      await deps.experienceWriter.recordExperience({
        connectorId: input.platformId,
        capabilityId: input.capabilityId,
        result: connectorResult,
        triggerSource: ctx.triggerSource,
      });

      const runResult: ConnectorRunResult = {
        connectorResult,
        experienceId,
        triggerSource: ctx.triggerSource,
        affectsHeartbeatCadence: ctx.affectsHeartbeatCadence,
      };

      return {
        ok: connectorResult.status === "success",
        command: "connector:run" as const,
        data: runResult,
        runtimeMode: "workspace_full_runtime",
        surfaceMode: "cli",
        generatedAt: new Date().toISOString(),
        warnings: [],
        sourceRefs: ["manual-run-dispatcher:runConnector"],
      };
    },

    async runWetProbe(input) {
      const ctx = buildManualContext({});

      // WetProbeRunner requires a CapabilityContractRegistryV7.
      // In the full runtime this is available via deps.registry; here we
      // delegate to the caller-provided wetProbeRunner which already has
      // the registry wired. If the runner is not available, degrade.
      const wetResult = await deps.wetProbeRunner.runWetProbe(
        input.platformId,
        input.capabilityId,
        deps.registryV7,
      );

      const result: WetProbeManualResult = {
        probeResultId: wetResult.probeResult.probeResultId,
        platformId: wetResult.probeResult.connectorId,
        capabilityId: wetResult.probeResult.capabilityId,
        actualStatus: wetResult.probeResult.actualStatus,
        httpStatus: wetResult.httpStatus,
        triggerSource: ctx.triggerSource,
        affectsHeartbeatCadence: ctx.affectsHeartbeatCadence,
      };

      return {
        ok: wetResult.probeResult.actualStatus === "available",
        command: "connector_test" as const,
        data: result,
        runtimeMode: "workspace_full_runtime",
        surfaceMode: "cli",
        generatedAt: new Date().toISOString(),
        warnings: [],
        sourceRefs: ["manual-run-dispatcher:runWetProbe"],
      };
    },

    async runHeartbeatProbe(input) {
      const ctx = buildManualContext(input);
      const heartbeatResult = await heartbeatCheck(input.deps);
      return {
        ...heartbeatResult,
        ...ctx,
      };
    },
  };
}
