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
// ─── DR-036 Timeout Constants ─────────────────────────────────────────────────
const PROBE_TIMEOUTS = {
    env: 200,
    storage: 200,
    cron: 500,
    bridge: 500,
    secret: 1000,
    credential: 1000,
    delivery: 800,
    circuit_breaker: 800,
    dream: 800,
    state_memory: 500,
    narrative_timeline: 500,
    digest: 500,
};
const STATE_MEMORY_DEGRADED_DIMENSIONS = new Set([
    "state_memory",
    "narrative_timeline",
    "digest",
]);
const TOTAL_TIMEOUT_MS = 3000;
// ─── Minimum required dimensions ─────────────────────────────────────────────
export const MINIMUM_REQUIRED_DIMENSIONS = [
    "env",
    "cron",
    "secret",
    "credential",
    "storage",
    "delivery",
    "dream",
    "bridge",
    "circuit_breaker",
    "state_memory",
];
// ─── Registry ─────────────────────────────────────────────────────────────────
const _probeRegistry = new Map();
/**
 * Register a health probe for a named dimension.
 * Built-in minimum dimensions are registered by default with no-op probes
 * that return healthy. Callers override with real probe functions.
 */
export function registerHealthProbe(probe) {
    _probeRegistry.set(probe.dimensionId, probe);
}
/**
 * Remove a probe from the registry (useful for testing).
 */
export function unregisterHealthProbe(dimensionId) {
    _probeRegistry.delete(dimensionId);
}
/**
 * Clear all registered probes (useful for testing).
 */
export function clearHealthProbeRegistry() {
    _probeRegistry.clear();
}
/** Get all currently registered probes. */
export function getRegisteredProbes() {
    return Array.from(_probeRegistry.values());
}
// ─── Default probes for minimum dimensions ───────────────────────────────────
function makeDefaultProbe(dimensionId) {
    const timeoutMs = PROBE_TIMEOUTS[dimensionId] ?? 500;
    const timeoutAsDegraded = STATE_MEMORY_DEGRADED_DIMENSIONS.has(dimensionId);
    return {
        dimensionId,
        timeoutMs,
        timeoutAsDegraded,
        probe: async () => ({
            status: "healthy",
            checkedAt: new Date().toISOString(),
        }),
    };
}
/**
 * Ensure minimum required dimensions are represented in the registry.
 * Existing registrations (real probes) are not overwritten.
 */
export function ensureMinimumProbes() {
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS) {
        if (!_probeRegistry.has(dim)) {
            _probeRegistry.set(dim, makeDefaultProbe(dim));
        }
    }
}
// ─── Probe runner ─────────────────────────────────────────────────────────────
/**
 * Run a single probe with per-probe timeout.
 * On timeout: returns unknown (or degraded for state_memory path, DR-032).
 * On error: returns unknown + error message.
 */
async function runProbeWithTimeout(rp, now) {
    const timeoutStatus = rp.timeoutAsDegraded ? "degraded" : "unknown";
    const timeoutReason = STATE_MEMORY_DEGRADED_DIMENSIONS.has(rp.dimensionId)
        ? "state_memory_unavailable"
        : `probe_timeout:${rp.dimensionId}`;
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                status: timeoutStatus,
                reason: timeoutReason,
                checkedAt: now,
            });
        }, rp.timeoutMs);
    });
    const probePromise = rp.probe().catch((err) => ({
        status: "unknown",
        reason: `probe_error:${rp.dimensionId}:${err instanceof Error ? err.message : String(err)}`,
        checkedAt: now,
    }));
    return [rp.dimensionId, await Promise.race([probePromise, timeoutPromise])];
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
export async function getSelfHealthSnapshot(scope, lastKnownAt) {
    // Ensure minimum probes exist
    ensureMinimumProbes();
    const now = new Date().toISOString();
    // Determine which probes to run
    const allProbes = Array.from(_probeRegistry.values());
    const probes = scope?.dimensions
        ? allProbes.filter((p) => scope.dimensions.includes(p.dimensionId))
        : allProbes;
    if (probes.length === 0) {
        return {
            generatedAt: now,
            overall: "unknown",
            reason: "no_probes_registered",
            lastKnownAt,
            dimensions: {},
            diagnosticReasonCodes: ["no_probes_registered"],
            degradedDimensions: [],
        };
    }
    // Run all probes with individual timeouts, wrapped in a 3s global cap
    const globalTimeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            // Return all probes as unknown on global timeout
            const fallback = probes.map((p) => [
                p.dimensionId,
                {
                    status: "unknown",
                    reason: `probe_timeout:${p.dimensionId}`,
                    checkedAt: now,
                },
            ]);
            resolve(fallback);
        }, TOTAL_TIMEOUT_MS);
    });
    const probeRunnerPromise = Promise.allSettled(probes.map((p) => runProbeWithTimeout(p, now))).then((results) => results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value));
    const results = await Promise.race([probeRunnerPromise, globalTimeoutPromise]);
    // Assemble dimensions map
    const dimensions = {};
    for (const [dimId, health] of results) {
        dimensions[dimId] = health;
    }
    // DR-032: if state_memory is degraded/unknown, propagate to narrative_timeline + digest
    const stateMemoryHealth = dimensions["state_memory"];
    if (stateMemoryHealth &&
        (stateMemoryHealth.status === "degraded" || stateMemoryHealth.status === "unknown")) {
        const smReason = "state_memory_unavailable";
        for (const dim of ["narrative_timeline", "digest"]) {
            if (dimensions[dim] && dimensions[dim].status === "healthy") {
                dimensions[dim] = {
                    status: "degraded",
                    reason: smReason,
                    checkedAt: now,
                };
            }
            else if (!dimensions[dim] && _probeRegistry.has(dim)) {
                dimensions[dim] = {
                    status: "degraded",
                    reason: smReason,
                    checkedAt: now,
                };
            }
        }
    }
    // Collect diagnostic reason codes and degraded dimensions
    const diagnosticReasonCodes = [];
    const degradedDimensions = [];
    for (const [dimId, health] of Object.entries(dimensions)) {
        if (health.status !== "healthy") {
            degradedDimensions.push(dimId);
            if (health.reason)
                diagnosticReasonCodes.push(health.reason);
        }
    }
    // Compute overall status
    const allUnknown = Object.values(dimensions).every((d) => d.status === "unknown");
    const anyDegraded = Object.values(dimensions).some((d) => d.status === "degraded");
    const anyUnknown = Object.values(dimensions).some((d) => d.status === "unknown");
    let overall;
    let reason;
    if (allUnknown) {
        overall = "unknown";
        reason = "all_probes_timed_out";
    }
    else if (anyDegraded || anyUnknown) {
        overall = "degraded";
    }
    else {
        overall = "healthy";
    }
    return {
        generatedAt: now,
        overall,
        reason,
        lastKnownAt: allUnknown ? lastKnownAt : undefined,
        dimensions,
        diagnosticReasonCodes,
        degradedDimensions,
    };
}
