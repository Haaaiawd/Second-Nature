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

export type UnavailableReasonCode =
  | "credentials_missing"
  | "not_registered"
  | "trust_denied"
  | "circuit_open"
  | "platform_error"
  | "probe_failed"
  | "probe_policy_denied";

export interface StructuredUnavailableReason {
  code: UnavailableReasonCode;
  message: string;
  platformId?: string;
  capabilityId?: string;
  failureClass?: FailureClass;
  retryAfterMs?: number;
  timestamp: string;
}

export class UnavailableReasonBuilder {
  private code?: UnavailableReasonCode;
  private message?: string;
  private platformId?: string;
  private capabilityId?: string;
  private failureClass?: FailureClass;
  private retryAfterMs?: number;

  static for(code: UnavailableReasonCode, message: string): UnavailableReasonBuilder {
    const b = new UnavailableReasonBuilder();
    b.code = code;
    b.message = message;
    return b;
  }

  withPlatformId(platformId: string): this {
    this.platformId = platformId;
    return this;
  }

  withCapabilityId(capabilityId: string): this {
    this.capabilityId = capabilityId;
    return this;
  }

  withFailureClass(failureClass: FailureClass): this {
    this.failureClass = failureClass;
    return this;
  }

  withRetryAfterMs(ms: number): this {
    this.retryAfterMs = ms;
    return this;
  }

  build(): StructuredUnavailableReason {
    if (!this.code) {
      throw new Error("UnavailableReasonBuilder: code is required");
    }
    if (!this.message) {
      throw new Error("UnavailableReasonBuilder: message is required");
    }
    return {
      code: this.code,
      message: this.message,
      platformId: this.platformId,
      capabilityId: this.capabilityId,
      failureClass: this.failureClass,
      retryAfterMs: this.retryAfterMs,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Convenience factory for common unavailable scenarios.
 */
export function unavailableCredentialsMissing(platformId: string): StructuredUnavailableReason {
  return UnavailableReasonBuilder.for(
    "credentials_missing",
    `No active credential found for platform ${platformId}`,
  )
    .withPlatformId(platformId)
    .build();
}

export function unavailableNotRegistered(platformId: string): StructuredUnavailableReason {
  return UnavailableReasonBuilder.for(
    "not_registered",
    `Connector manifest not registered for platform ${platformId}`,
  )
    .withPlatformId(platformId)
    .build();
}

export function unavailableTrustDenied(platformId: string): StructuredUnavailableReason {
  return UnavailableReasonBuilder.for(
    "trust_denied",
    `Credential verification failed for platform ${platformId}`,
  )
    .withPlatformId(platformId)
    .build();
}

export function unavailableCircuitOpen(
  platformId: string,
  retryAfterMs?: number,
): StructuredUnavailableReason {
  const b = UnavailableReasonBuilder.for(
    "circuit_open",
    `Circuit breaker open for platform ${platformId}`,
  ).withPlatformId(platformId);
  if (retryAfterMs !== undefined) b.withRetryAfterMs(retryAfterMs);
  return b.build();
}

export function unavailablePlatformError(
  platformId: string,
  failureClass?: FailureClass,
): StructuredUnavailableReason {
  const b = UnavailableReasonBuilder.for(
    "platform_error",
    `Platform error for ${platformId}`,
  ).withPlatformId(platformId);
  if (failureClass) b.withFailureClass(failureClass);
  return b.build();
}

export function unavailableProbeFailed(
  platformId: string,
  capabilityId: string,
): StructuredUnavailableReason {
  return UnavailableReasonBuilder.for(
    "probe_failed",
    `Wet probe failed for ${platformId}:${capabilityId}`,
  )
    .withPlatformId(platformId)
    .withCapabilityId(capabilityId)
    .build();
}

export function unavailableProbePolicyDenied(
  platformId: string,
  capabilityId: string,
): StructuredUnavailableReason {
  return UnavailableReasonBuilder.for(
    "probe_policy_denied",
    `Probe blocked by policy (strict idempotencyClass) for ${platformId}:${capabilityId}`,
  )
    .withPlatformId(platformId)
    .withCapabilityId(capabilityId)
    .build();
}
