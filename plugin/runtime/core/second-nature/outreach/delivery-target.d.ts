/**
 * Resolves OpenClaw-visible delivery target from host capability snapshot (T2.3.1 / ADR-007).
 *
 * Core logic: explicit/last targets require channel materialization; `none` is a first-class verdict.
 * Test coverage: tests/unit/core/outreach-judgment.test.ts
 */
export type DeliveryHostTarget = "none" | "last" | "explicit";
export interface DeliveryCapabilitySnapshot {
    /** Raw host value; may be empty string before normalization. */
    target?: DeliveryHostTarget | string | null;
    channel?: string | null;
    recipient?: string | null;
    lastKnownVisibleChannel?: string | null;
    /** When true, host reports unsupported delivery surface (maps to host_unsupported verdict). */
    hostUnsupported?: boolean;
}
export type DeliveryTargetVerdict = "target_none" | "channel_missing" | "target_available" | "host_unsupported";
export interface DeliveryTargetResolution {
    verdict: DeliveryTargetVerdict;
    target?: DeliveryHostTarget;
    channel?: string;
    recipient?: string;
    reason: string;
}
export declare function resolveDeliveryTarget(snapshot: DeliveryCapabilitySnapshot): DeliveryTargetResolution;
export declare function isDeliveryUnavailableReason(reason: string): boolean;
