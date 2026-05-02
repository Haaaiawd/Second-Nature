/**
 * Stable HeartbeatSurfaceResult for second_nature_ops / CLI (T1.1.3, cli-system / ADR-005).
 *
 * S1 scope: carrier / probe / runtime-unavailable / fake control-plane passthrough only.
 */
import type { SurfaceMode } from "../runtime/runtime-artifact-boundary.js";
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
}
export declare function heartbeatCheck(input: HeartbeatCheckInput): HeartbeatSurfaceResult;
