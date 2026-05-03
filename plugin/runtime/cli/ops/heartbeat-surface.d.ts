/**
 * Stable HeartbeatSurfaceResult for second_nature_ops / CLI (T1.1.3, cli-system / ADR-005).
 *
 * S1 scope: carrier / probe / runtime-unavailable / fake control-plane passthrough only.
 * Workspace full runtime: delegates to `runHeartbeatCycle` when read models are wired (US-001 / CH-09-02).
 */
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";
import type { HeartbeatSignal } from "../../core/second-nature/heartbeat/signal.js";
import type { CliReadModels } from "../read-models/index.js";
export type HeartbeatSurfaceStatus = "heartbeat_ok" | "intent_selected" | "denied" | "deferred" | "runtime_carrier_only" | "delivery_unavailable";
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
    timestamp?: string;
    sessionContext?: string;
    scopeHint?: HeartbeatSignal["scopeHint"];
}
export declare function heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
