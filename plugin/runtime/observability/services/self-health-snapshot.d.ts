/**
 * SelfHealthSnapshot — T-OBS.C.2
 *
 * Core logic: Run independent health probes for each registered dimension,
 * each with per-probe timeout (DR-036). Total cap: 3000ms via Promise.allSettled.
 * Returns SelfHealthSnapshot with overall status and per-dimension results.
 *
 * DR-036 timeouts:
 *   env / storage         200ms  → unknown + probe_timeout:env
 *   cron / bridge         500ms  → unknown + probe_timeout:cron
 *   secret / credential   1000ms → unknown + probe_timeout:secret
 *   delivery / circuit    800ms  → unknown + probe_timeout:delivery
 *   state_memory          500ms  → degraded + state_memory_unavailable
 *
 * DR-032 circular dependency degradation:
 *   If state-memory is unavailable, narrative_timeline and digest probes
 *   return degraded — other probes are unaffected.
 *
 * Total timeout:
 *   All probes run concurrently via Promise.allSettled, capped at 3000ms.
 *   If ALL probes time out: overall = "unknown", reason = "all_probes_timed_out".
 *
 * Dynamic dimension registration:
 *   Callers can register additional probe functions via registerHealthProbe().
 *   Minimum required dimensions are always included.
 *
 * Test coverage: tests/unit/observability/self-health-snapshot.test.ts
 */
export type HealthStatus = "healthy" | "degraded" | "unknown";
export interface DimensionHealth {
    status: HealthStatus;
    reason?: string;
    checkedAt: string;
    lastKnownAt?: string;
}
export interface SelfHealthSnapshot {
    generatedAt: string;
    overall: HealthStatus;
    /** Populated if overall = "unknown" due to all probes timing out */
    reason?: string;
    /** Timestamp of last successful snapshot (for all-timeout fallback) */
    lastKnownAt?: string;
    dimensions: Record<string, DimensionHealth>;
    diagnosticReasonCodes: string[];
    /** Dimension IDs that are degraded or unknown */
    degradedDimensions: string[];
}
/** A probe function: resolves with DimensionHealth or throws on error */
export type HealthProbeFunction = () => Promise<DimensionHealth>;
export interface RegisteredProbe {
    dimensionId: string;
    probe: HealthProbeFunction;
    timeoutMs: number;
    /** If true, timeout returns "degraded" instead of "unknown" (DR-032 state-memory path) */
    timeoutAsDegraded?: boolean;
}
export declare const MINIMUM_REQUIRED_DIMENSIONS: string[];
/**
 * Register a health probe for a named dimension.
 * Built-in minimum dimensions are registered by default with no-op probes
 * that return healthy. Callers override with real probe functions.
 */
export declare function registerHealthProbe(probe: RegisteredProbe): void;
/**
 * Remove a probe from the registry (useful for testing).
 */
export declare function unregisterHealthProbe(dimensionId: string): void;
/**
 * Clear all registered probes (useful for testing).
 */
export declare function clearHealthProbeRegistry(): void;
/** Get all currently registered probes. */
export declare function getRegisteredProbes(): RegisteredProbe[];
/**
 * Ensure minimum required dimensions are represented in the registry.
 * Existing registrations (real probes) are not overwritten.
 */
export declare function ensureMinimumProbes(): void;
export interface HealthProbeScope {
    /** If specified, only run probes for these dimension IDs */
    dimensions?: string[];
}
/**
 * Run all registered health probes and assemble SelfHealthSnapshot.
 *
 * Probes run concurrently (Promise.allSettled) with per-probe timeouts (DR-036).
 * Total cap: 3000ms.
 * All-timeout fallback: overall = "unknown", reason = "all_probes_timed_out".
 *
 * DR-032: state_memory probe timeout marks narrative_timeline + digest as degraded too.
 */
export declare function getSelfHealthSnapshot(scope?: HealthProbeScope, lastKnownAt?: string): Promise<SelfHealthSnapshot>;
