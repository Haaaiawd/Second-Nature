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
export function createCircuitBreakerManager(options) {
    const { database: { sqlite }, probeAdapter, failureThreshold = 3, cooldownMs = 30_000, onClosed, } = options;
    function loadRecord(platformId, capabilityId) {
        const result = sqlite.exec(`SELECT * FROM circuit_breaker_state
       WHERE platform_id = ? AND capability_id = ?`, [platformId, capabilityId]);
        if (result.length === 0 || result[0].values.length === 0) {
            return {
                platformId,
                capabilityId,
                state: "closed",
                failureCount: 0,
                consecutiveFailures: 0,
            };
        }
        const cols = result[0].columns;
        const get = (name) => result[0].values[0][cols.indexOf(name)];
        return {
            platformId,
            capabilityId,
            state: get("state"),
            failureCount: get("failure_count") ?? 0,
            consecutiveFailures: get("consecutive_failures") ?? 0,
            lastFailureAt: get("last_failure_at") ?? undefined,
            openedAt: get("opened_at") ?? undefined,
            lastProbeAt: get("last_probe_at") ?? undefined,
        };
    }
    function saveRecord(rec) {
        const now = new Date().toISOString();
        sqlite.run(`INSERT INTO circuit_breaker_state
       (platform_id, capability_id, state, failure_count, consecutive_failures,
        last_failure_at, opened_at, last_probe_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(platform_id, capability_id) DO UPDATE SET
         state = excluded.state,
         failure_count = excluded.failure_count,
         consecutive_failures = excluded.consecutive_failures,
         last_failure_at = excluded.last_failure_at,
         opened_at = excluded.opened_at,
         last_probe_at = excluded.last_probe_at,
         updated_at = excluded.updated_at`, [
            rec.platformId,
            rec.capabilityId,
            rec.state,
            rec.failureCount,
            rec.consecutiveFailures,
            rec.lastFailureAt ?? null,
            rec.openedAt ?? null,
            rec.lastProbeAt ?? null,
            now,
        ]);
    }
    return {
        async evaluateFailure(platformId, capabilityId) {
            const rec = loadRecord(platformId, capabilityId);
            rec.consecutiveFailures += 1;
            rec.failureCount += 1;
            rec.lastFailureAt = new Date().toISOString();
            if (rec.state === "closed" && rec.consecutiveFailures >= failureThreshold) {
                rec.state = "open";
                rec.openedAt = rec.lastFailureAt;
            }
            else if (rec.state === "half_open") {
                // HalfOpen + failure → back to Open
                rec.state = "open";
                rec.openedAt = rec.lastFailureAt;
            }
            // open + failure stays open
            saveRecord(rec);
            return rec.state;
        },
        async evaluateSuccess(platformId, capabilityId) {
            const rec = loadRecord(platformId, capabilityId);
            if (rec.state === "half_open") {
                rec.state = "closed";
                rec.consecutiveFailures = 0;
                rec.openedAt = undefined;
                if (onClosed) {
                    onClosed(platformId, capabilityId);
                }
            }
            else if (rec.state === "closed") {
                rec.consecutiveFailures = 0;
            }
            // open + success stays open (should not happen via normal path)
            saveRecord(rec);
            return rec.state;
        },
        async canExecute(platformId, capabilityId) {
            const rec = loadRecord(platformId, capabilityId);
            if (rec.state === "closed")
                return true;
            if (rec.state === "half_open")
                return true; // allow limited probe traffic
            if (rec.state === "open") {
                if (rec.openedAt) {
                    const elapsed = Date.now() - new Date(rec.openedAt).getTime();
                    if (elapsed >= cooldownMs) {
                        return true; // let caller attempt, will transition to HalfOpen
                    }
                }
                return false;
            }
            return true;
        },
        async getState(platformId, capabilityId) {
            return loadRecord(platformId, capabilityId).state;
        },
        async attemptReset(platformId, capabilityId) {
            const rec = loadRecord(platformId, capabilityId);
            if (rec.state !== "half_open" && rec.state !== "open") {
                return rec.state;
            }
            // If cooldown has elapsed from Open, transition to HalfOpen and probe
            if (rec.state === "open" && rec.openedAt) {
                const elapsed = Date.now() - new Date(rec.openedAt).getTime();
                if (elapsed < cooldownMs) {
                    return rec.state; // still cooling
                }
                rec.state = "half_open";
                saveRecord(rec);
            }
            // HalfOpen: run wet probe
            const probeResult = await probeAdapter.runAndRecordProbe(platformId, capabilityId, options.registry);
            rec.lastProbeAt = new Date().toISOString();
            if (probeResult.httpStatus === 0 && probeResult.actualStatus === "unavailable") {
                // probe_policy_denied or network failure → stay HalfOpen
                saveRecord(rec);
                return rec.state;
            }
            if (probeResult.actualStatus === "available") {
                rec.state = "closed";
                rec.consecutiveFailures = 0;
                rec.openedAt = undefined;
                if (onClosed) {
                    onClosed(platformId, capabilityId);
                }
            }
            else {
                rec.state = "open";
                rec.openedAt = new Date().toISOString();
            }
            saveRecord(rec);
            return rec.state;
        },
    };
}
