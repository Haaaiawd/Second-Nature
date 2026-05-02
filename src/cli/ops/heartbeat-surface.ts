/**
 * Stable HeartbeatSurfaceResult for second_nature_ops / CLI (T1.1.3, cli-system / ADR-005).
 *
 * S1 scope: carrier / probe / runtime-unavailable / fake control-plane passthrough only.
 */
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";

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
}

export function heartbeatCheck(input: HeartbeatCheckInput): HeartbeatSurfaceResult {
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

  return {
    ok: true,
    status: "heartbeat_ok",
    surfaceMode: "workspace_full_runtime",
    reasons: ["s1_placeholder_no_decision_loop"],
    livedExperienceLoopClaimed: false,
  };
}
