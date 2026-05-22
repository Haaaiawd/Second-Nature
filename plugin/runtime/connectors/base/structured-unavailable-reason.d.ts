/**
 * StructuredUnavailableReason Builder — T-CS.C.3
 *
 * Core logic: Every unavailable-connector scenario MUST return a machine-
 * readable reason code. No silent failures allowed.
 *
 * Reason codes:
 * - credentials_missing   → credential not found for platform
 * - not_registered        → connector manifest not in registry
 * - trust_denied          → credential verification failed
 * - circuit_open          → circuit breaker is open (cooldown blocked)
 * - platform_error        → platform returned 5xx / transport failure
 * - probe_failed          → wet probe returned non-2xx
 * - probe_policy_denied   → strict idempotencyClass blocked probe (DR-006)
 *
 * Dependencies:
 * - `FailureClass` from `./failure-taxonomy.js`
 *
 * Boundary:
 * - All builder methods are pure; no side effects.
 * - `build()` validates that code and message are present.
 *
 * Test coverage: tests/unit/connectors/structured-unavailable-reason.test.ts
 */
import type { FailureClass } from "./failure-taxonomy.js";
export type UnavailableReasonCode = "credentials_missing" | "not_registered" | "trust_denied" | "circuit_open" | "platform_error" | "probe_failed" | "probe_policy_denied";
export interface StructuredUnavailableReason {
    code: UnavailableReasonCode;
    message: string;
    platformId?: string;
    capabilityId?: string;
    failureClass?: FailureClass;
    retryAfterMs?: number;
    timestamp: string;
}
export declare class UnavailableReasonBuilder {
    private code?;
    private message?;
    private platformId?;
    private capabilityId?;
    private failureClass?;
    private retryAfterMs?;
    static for(code: UnavailableReasonCode, message: string): UnavailableReasonBuilder;
    withPlatformId(platformId: string): this;
    withCapabilityId(capabilityId: string): this;
    withFailureClass(failureClass: FailureClass): this;
    withRetryAfterMs(ms: number): this;
    build(): StructuredUnavailableReason;
}
/**
 * Convenience factory for common unavailable scenarios.
 */
export declare function unavailableCredentialsMissing(platformId: string): StructuredUnavailableReason;
export declare function unavailableNotRegistered(platformId: string): StructuredUnavailableReason;
export declare function unavailableTrustDenied(platformId: string): StructuredUnavailableReason;
export declare function unavailableCircuitOpen(platformId: string, retryAfterMs?: number): StructuredUnavailableReason;
export declare function unavailablePlatformError(platformId: string, failureClass?: FailureClass): StructuredUnavailableReason;
export declare function unavailableProbeFailed(platformId: string, capabilityId: string): StructuredUnavailableReason;
export declare function unavailableProbePolicyDenied(platformId: string, capabilityId: string): StructuredUnavailableReason;
