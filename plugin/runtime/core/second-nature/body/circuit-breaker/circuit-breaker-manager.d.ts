/**
 * CircuitBreakerManager — T-BTS.C.5
 *
 * Core logic: State machine (Closed → Open → HalfOpen → Closed/Open).
 * - Closed: counts consecutive failures; threshold hit → Open.
 * - Open: rejects execution; cooldown elapsed → HalfOpen.
 * - HalfOpen: initiates runWetProbe via ProbeSignalAdapter.
 *   - strict side-effect → probe_policy_denied, stays HalfOpen.
 *   - probe success → Closed + invalidate affordance cache (DR-003).
 *   - probe failure → Open.
 *
 * Persistence:
 * - State stored in SQLite `circuit_breaker_state` table (v7-003).
 * - Loads previous state on first access.
 *
 * Dependencies:
 * - `StateDatabase` from `../../../../storage/db/index.js`
 * - `WetProbeRunner` from `../../../../connectors/base/wet-probe-runner.js`
 * - `CapabilityContractRegistryV7` from `../../../../connectors/base/manifest-v7.js`
 * - `ProbeSignalAdapter` from `../probe-signal-adapter.js`
 *
 * Boundary:
 * - Manager decides WHEN to probe (DR-002); connector-system executes it.
 * - Does NOT execute HTTP directly — delegates to ProbeSignalAdapter.
 *
 * Test coverage: tests/unit/body/circuit-breaker-manager.test.ts
 */
import type { StateDatabase } from "../../../../storage/db/index.js";
import type { CapabilityContractRegistryV7 } from "../../../../connectors/base/manifest-v7.js";
import type { ProbeSignalAdapter } from "../probe-signal-adapter.js";
export type BreakerState = "closed" | "open" | "half_open";
export interface BreakerRecord {
    platformId: string;
    capabilityId: string;
    state: BreakerState;
    failureCount: number;
    consecutiveFailures: number;
    lastFailureAt?: string;
    openedAt?: string;
    lastProbeAt?: string;
}
export interface CircuitBreakerManager {
    evaluateFailure(platformId: string, capabilityId: string): Promise<BreakerState>;
    evaluateSuccess(platformId: string, capabilityId: string): Promise<BreakerState>;
    canExecute(platformId: string, capabilityId: string): Promise<boolean>;
    getState(platformId: string, capabilityId: string): Promise<BreakerState>;
    attemptReset(platformId: string, capabilityId: string): Promise<BreakerState>;
}
export interface CircuitBreakerManagerOptions {
    database: StateDatabase;
    probeAdapter: ProbeSignalAdapter;
    registry: CapabilityContractRegistryV7;
    /** Consecutive failures before opening. Default 3. */
    failureThreshold?: number;
    /** Cooldown in ms before HalfOpen. Default 30_000. */
    cooldownMs?: number;
    /** Callback when breaker transitions to Closed (for affordance cache invalidation). */
    onClosed?: (platformId: string, capabilityId: string) => void;
}
export declare function createCircuitBreakerManager(options: CircuitBreakerManagerOptions): CircuitBreakerManager;
