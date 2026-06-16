/**
 * Stable HeartbeatSurfaceResult for second_nature_ops / CLI (T1.1.3, cli-system / ADR-005).
 *
 * S1 scope: carrier / probe / runtime-unavailable / fake control-plane passthrough only.
 * Workspace full runtime: delegates to `runHeartbeatCycle` when read models are wired (US-001 / CH-09-02).
 */
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";
import type {
  HeartbeatCycleResult,
  HeartbeatSignal,
} from "../../core/second-nature/heartbeat/signal.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { createWorkspaceHeartbeatRunner } from "./workspace-heartbeat-runner.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { AffordanceMap } from "../../shared/types/v7-entities.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { QuietDreamSchedulePort } from "../../core/second-nature/quiet/run-source-backed-quiet.js";
import type { HeartbeatDigestAssemblerDeps } from "../../observability/services/heartbeat-digest-assembler.js";
import type { GoalLifecyclePolicy } from "../../core/second-nature/heartbeat/goal-lifecycle-policy.js";
import type { IdleCuriosityPolicy } from "../../core/second-nature/heartbeat/idle-curiosity-policy.js";
import type { CircuitBreakerManager } from "../../core/second-nature/body/circuit-breaker/circuit-breaker-manager.js";
import type { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
// T-CP.R.2: v8 real runtime spine bridge
import {
  runRealRuntimeHeartbeatCycle,
  type RealRuntimeSpineResult,
} from "../../core/second-nature/control-plane/real-runtime-spine.js";

async function refreshHeartbeatImpulseContext(state: StateDatabase, now: string): Promise<string | undefined> {
  const { assembleImpulseSync } = await import("../../guidance/impulse-assembler.js");
  const { buildExpressionBoundary } = await import("../../guidance/output-guard.js");
  const { getShortAtmosphereTemplate } = await import("../../guidance/template-registry.js");
  const { writeImpulseContext } = await import("../../core/second-nature/guidance/impulse-context-writer.js");

  const impulseResult = assembleImpulseSync({ sceneType: "heartbeat" });
  const atmosphere = getShortAtmosphereTemplate("active", "low");
  const expressionBoundary = buildExpressionBoundary("heartbeat");
  const result = await writeImpulseContext(
    state,
    {
      sceneType: "heartbeat",
      impulseResult,
      atmosphereText: atmosphere.text,
      expressionBoundaryConstraints: expressionBoundary.constraints,
      expressionBoundaryStyle: expressionBoundary.style,
    },
    { now },
  );

  return "id" in result ? result.id : undefined;
}

export type HeartbeatSurfaceStatus =
  | "heartbeat_ok"
  | "intent_selected"
  | "denied"
  | "deferred"
  | "runtime_carrier_only"
  | "delivery_unavailable";

export interface HeartbeatSurfaceResult {
  ok: boolean;
  status: HeartbeatSurfaceStatus;
  surfaceMode: SurfaceMode;
  decisionId?: string;
  deliveryAttemptId?: string;
  capabilityReportRef?: string;
  fallbackRef?: string;
  reasons: string[];
  /** When false, callers must not treat the round as lived-experience loop completion */
  livedExperienceLoopClaimed: boolean;
  /** True when structured fields mirror a fake adapter for schema parity only */
  schemaParityOnly?: boolean;
  /** T-CP.R.2: v8 real runtime spine result when state-backed action-closure spine ran */
  v8Spine?: RealRuntimeSpineResult & { degradedReason?: string };
  /** T-GVS.R.1: agent-facing impulse context artifact read pointer */
  impulseContext?: {
    available: boolean;
    sceneType?: string;
    capabilityClass?: string | null;
    impulseText?: string | null;
    atmosphereText?: string | null;
    expressionBoundaryConstraints?: string[] | null;
    expressionBoundaryStyle?: string | null;
    freshnessMs?: number;
    missingReason?: string;
  };
}

export interface HeartbeatCheckInput {
  probeOnly?: boolean;
  runtimeAvailable: boolean;
  fakeControlPlanePassthrough?: Record<string, unknown>;
  /** When set, full-runtime heartbeat_check runs the control-plane decision loop (US-001). */
  readModels?: CliReadModels;
  /** When set, full-runtime cycles are persisted so `loadStatus` exits unknown (T1.2.3). */
  runtimeRecorder?: RuntimeDecisionRecorder;
  /**
   * T2.2.2: when set together with `workspaceRoot`, life evidence from the state DB is loaded
   * and merged into SnapshotInputs so planner/guard paths see real source-ref truth.
   */
  state?: StateDatabase;
  workspaceRoot?: string;
  timestamp?: string;
  sessionContext?: string;
  scopeHint?: HeartbeatSignal["scopeHint"];
  /**
   * When present, guard-allowed connector_action intents are dispatched through the
   * connector-system instead of returning connector_dispatch_unwired.
   */
  connectorExecutor?: ConnectorExecutor;
  /** Capability registry used by planner to avoid platform/capability protocol mismatches. */
  connectorRegistry?: CapabilityContractRegistry;
  /** v7 T-V7C.C.2: affordance map for breaker-aware guard evaluation. */
  affordanceMap?: AffordanceMap;
  /** v7 T-V7C.C.2: experience writer for heartbeat connector attempts. */
  experienceWriter?: ExperienceWriter;
  /**
   * v7 T-V7C.C.6: when present, a successful Quiet write auto-triggers Dream scheduling.
   * Fixes the production-data gap where dream_output_index does not grow after Quiet.
   */
  dreamSchedulePort?: QuietDreamSchedulePort;
  /**
   * v7 T-V7C.C.6: when present, generates a HeartbeatDigest after each cycle.
   * Fixes the production-data gap where heartbeat_digest does not grow.
   */
  digestOpts?: {
    assemblerDeps: HeartbeatDigestAssemblerDeps;
    digestWindowHour?: number;
  };
  /** v7 T-CP.C.3: goal lifecycle policy for evaluating goal transitions. */
  goalLifecyclePolicy?: GoalLifecyclePolicy;
  /** v7 T-CP.C.3: idle curiosity policy for read-only sensing when no active goals. */
  idleCuriosityPolicy?: IdleCuriosityPolicy;
  /** v7 T-BTS.C.5: circuit breaker manager for connector execution health. */
  circuitBreakerManager?: CircuitBreakerManager;
  /** T-OBS.R.1: shared audit sink for connector/Quiet events consumed by heartbeat_digest. */
  auditStore?: AppendOnlyAuditStore;
  /**
   * T-CP.R.2: when true and state DB is wired, runs the v8 real runtime action-closure spine
   * in addition to the v7 heartbeat loop. Produces state-backed closure/no-action records.
   */
  v8SpineEnabled?: boolean;
}

function mapCycleToSurface(
  cycle: HeartbeatCycleResult,
  surfaceMode: SurfaceMode,
): HeartbeatSurfaceResult {
  const status: HeartbeatSurfaceStatus =
    cycle.status === "runtime_carrier_only"
      ? "runtime_carrier_only"
      : (cycle.status as HeartbeatSurfaceStatus);
  return {
    ok: true,
    status,
    surfaceMode,
    decisionId: cycle.decisionId,
    deliveryAttemptId: cycle.deliveryAttemptId,
    fallbackRef: cycle.fallbackRef,
    reasons: cycle.reasons,
    livedExperienceLoopClaimed: false,
  };
}

export async function heartbeatCheck(
  input: HeartbeatCheckInput,
): Promise<HeartbeatSurfaceResult> {
  if (!input.runtimeAvailable) {
    return {
      ok: true,
      status: "runtime_carrier_only",
      surfaceMode: "host_safe_carrier",
      reasons: ["runtime_unavailable_packaged_carrier"],
      livedExperienceLoopClaimed: false,
    };
  }

  if (input.probeOnly) {
    return {
      ok: true,
      status: "heartbeat_ok",
      surfaceMode: "capability_probe",
      reasons: ["probe_only"],
      livedExperienceLoopClaimed: false,
    };
  }

  if (input.fakeControlPlanePassthrough) {
    const decisionId =
      typeof input.fakeControlPlanePassthrough.decisionId === "string"
        ? input.fakeControlPlanePassthrough.decisionId
        : undefined;
    return {
      ok: true,
      status: "intent_selected",
      surfaceMode: "host_safe_carrier",
      reasons: ["fake_control_plane_passthrough"],
      decisionId,
      livedExperienceLoopClaimed: false,
      schemaParityOnly: true,
    };
  }

  if (!input.readModels) {
    return {
      ok: true,
      status: "runtime_carrier_only",
      surfaceMode: "host_safe_carrier",
      reasons: ["heartbeat_read_models_unavailable"],
      livedExperienceLoopClaimed: false,
    };
  }

  const timestamp =
    typeof input.timestamp === "string" && input.timestamp.trim().length > 0
      ? input.timestamp.trim()
      : new Date().toISOString();
  const signal: HeartbeatSignal = {
    trigger: "heartbeat_bridge",
    scopeHint: input.scopeHint,
    payload: {
      timestamp,
      sessionContext:
        typeof input.sessionContext === "string"
          ? input.sessionContext
          : undefined,
    },
  };

  const run = createWorkspaceHeartbeatRunner(input.readModels, {
    runtimeRecorder: input.runtimeRecorder,
    state: input.state,
    workspaceRoot: input.workspaceRoot ?? process.cwd(),
    connectorExecutor: input.connectorExecutor,
    connectorRegistry: input.connectorRegistry,
    affordanceMap: input.affordanceMap,
    experienceWriter: input.experienceWriter,
    dreamSchedulePort: input.dreamSchedulePort,
    digestOpts: input.digestOpts,
    goalLifecyclePolicy: input.goalLifecyclePolicy,
    idleCuriosityPolicy: input.idleCuriosityPolicy,
    circuitBreakerManager: input.circuitBreakerManager,
    auditStore: input.auditStore,
  });
  try {
    const cycle = await run(signal);
    const surfaceResult = mapCycleToSurface(cycle, "workspace_full_runtime");

    // T-CP.R.2: run v8 real runtime spine when enabled and state is available
    if (input.v8SpineEnabled && input.state && input.workspaceRoot) {
      try {
        const v8Result = await runRealRuntimeHeartbeatCycle({
          workspaceRoot: input.workspaceRoot,
          state: input.state,
          requestedAt: timestamp,
          trigger: "host",
        });

        if ("status" in v8Result && v8Result.status === "degraded") {
          surfaceResult.v8Spine = {
            cycleId: "",
            cycleSequence: 0,
            degradedReason: v8Result.reason,
          };
          surfaceResult.reasons = [
            ...surfaceResult.reasons,
            `v8_spine_degraded:${v8Result.reason}`,
          ];
        } else {
          const spine = v8Result as RealRuntimeSpineResult;
          const artifactId = await refreshHeartbeatImpulseContext(input.state, timestamp);
          if (artifactId) {
            spine.impulseContextArtifactId = artifactId;
            surfaceResult.reasons.push(`impulse_context_refreshed:${artifactId}`);
          }
          surfaceResult.v8Spine = spine;
          surfaceResult.livedExperienceLoopClaimed = Boolean(
            spine.cycleId && (spine.closureRef || spine.noActionReason),
          );
          surfaceResult.reasons = [
            ...surfaceResult.reasons,
            `v8_spine_cycle:${spine.cycleId}`,
            spine.closureRef
              ? "v8_closure_recorded"
              : `v8_no_action:${spine.noActionReason ?? "unknown"}`,
          ];
        }
      } catch (v8Err) {
        const v8Msg = v8Err instanceof Error ? v8Err.message : String(v8Err);
        surfaceResult.reasons = [
          ...surfaceResult.reasons,
          `v8_spine_exception:${v8Msg.slice(0, 120)}`,
        ];
      }
    }

    // T-GVS.R.1: expose impulse context artifact when state is available
    if (input.state) {
      try {
        const { readImpulseContext } = await import(
          "../../core/second-nature/guidance/impulse-context-reader.js"
        );
        const ctx = await readImpulseContext(input.state, "heartbeat");
        if (ctx.available) {
          surfaceResult.impulseContext = {
            available: true,
            sceneType: ctx.artifact.sceneType,
            capabilityClass: ctx.artifact.capabilityClass,
            impulseText: ctx.artifact.impulseText,
            atmosphereText: ctx.artifact.atmosphereText,
            expressionBoundaryConstraints: ctx.artifact.expressionBoundaryConstraints,
            expressionBoundaryStyle: ctx.artifact.expressionBoundaryStyle,
            freshnessMs: ctx.freshnessMs,
          };
          surfaceResult.reasons.push(`impulse_context:${ctx.artifact.id}`);
        } else {
          surfaceResult.impulseContext = {
            available: false,
            missingReason: ctx.reason,
          };
          surfaceResult.reasons.push(`impulse_context_missing:${ctx.reason}`);
        }
      } catch (readErr) {
        const msg = readErr instanceof Error ? readErr.message : String(readErr);
        surfaceResult.impulseContext = {
          available: false,
          missingReason: `read_exception:${msg.slice(0, 120)}`,
        };
        surfaceResult.reasons.push(`impulse_context_read_failed:${msg.slice(0, 120)}`);
      }
    }

    return surfaceResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: "denied",
      surfaceMode: "workspace_full_runtime",
      reasons: [`heartbeat_cycle_exception:${msg.slice(0, 120)}`],
      livedExperienceLoopClaimed: false,
    };
  }
}
