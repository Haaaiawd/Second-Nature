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
import type { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import { recordConnectorAttemptAudit } from "../../observability/services/audit-closure-recorders.js";
import {
  heartbeatCheck,
  type HeartbeatCheckInput,
  type HeartbeatSurfaceResult,
} from "./heartbeat-surface.js";
import type { RuntimeOpsEnvelope } from "./ops-router.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { appendLifeEvidence } from "../../storage/life-evidence/append-life-evidence.js";
import { mapLifeEvidence } from "../../connectors/base/map-life-evidence.js";
import { normalizeConnectorEvidence } from "../../connectors/evidence-normalizer.js";
import type { CapabilityIntent } from "../../connectors/base/contract.js";

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
  evidence?: {
    v7EvidenceId?: string;
    v8EvidenceIds: string[];
    emptyReason?: string;
  };
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
  auditStore?: AppendOnlyAuditStore;
  /** Workspace state database for evidence persistence (v7 life_evidence + v8 EvidenceItem). */
  state?: StateDatabase;
  /** Workspace root required for v7 life evidence JSON artifacts. */
  workspaceRoot?: string;
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
      const now = new Date().toISOString();

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
      recordConnectorAttemptAudit({
        auditStore: deps.auditStore,
        platformId: input.platformId,
        capability: input.capabilityId,
        result: connectorResult,
        triggerSource: ctx.triggerSource,
        decisionId,
        intentId,
      });

      const evidenceSummary: ConnectorRunResult["evidence"] = {
        v8EvidenceIds: [],
      };

      if (connectorResult.status === "success" && deps.state) {
        const capabilityIntent = input.capabilityId as CapabilityIntent;

        // v7 life evidence double-write (parity with heartbeat loop)
        try {
          if (deps.workspaceRoot) {
            const lifeCandidate = mapLifeEvidence({
              platformId: input.platformId,
              intent: capabilityIntent,
              result: connectorResult,
              observedAt: now,
            });
            if (lifeCandidate) {
              const lifeAck = await appendLifeEvidence(deps.state, deps.workspaceRoot, lifeCandidate);
              evidenceSummary.v7EvidenceId = lifeAck.evidenceId;
            }
          }
        } catch (v7Err) {
          const msg = v7Err instanceof Error ? v7Err.message : String(v7Err);
          console.warn(`[connector:run] v7 life evidence append failed for ${input.platformId}: ${msg}`);
        }

        // v8 EvidenceItem content-bearing write
        try {
          const v8Result = await normalizeConnectorEvidence(deps.state, {
            status: "success",
            platformId: input.platformId,
            capabilityId: input.capabilityId,
            data: connectorResult.data,
            observedAt: now,
          });
          evidenceSummary.v8EvidenceIds = v8Result.evidenceIds;
          evidenceSummary.emptyReason = v8Result.emptyReason;
          if (v8Result.degraded) {
            console.warn(`[connector:run] v8 evidence normalization degraded for ${input.platformId}: ${v8Result.degraded.reason}`);
          }
        } catch (v8Err) {
          const msg = v8Err instanceof Error ? v8Err.message : String(v8Err);
          console.warn(`[connector:run] v8 evidence normalization failed for ${input.platformId}: ${msg}`);
        }
      }

      const runResult: ConnectorRunResult = {
        connectorResult,
        experienceId,
        triggerSource: ctx.triggerSource,
        affectsHeartbeatCadence: ctx.affectsHeartbeatCadence,
        evidence: evidenceSummary,
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
