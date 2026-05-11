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
  });
  const cycle = await run(signal);
  return mapCycleToSurface(cycle, "workspace_full_runtime");
}
