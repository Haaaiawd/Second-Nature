/**
 * WetProbeRunner — T-CS.C.2
 *
 * Core logic: Performs real HTTP GET against a connector's safe probe endpoint.
 * Double-verifies `safe_for_probe` before issuing the request:
 *  1. IdempotencyClass check: `strict` side-effects are rejected with
 *     `probe_policy_denied` (DR-006).
 *  2. Endpoint validation: only `safeEndpoint` from probeConfig is allowed.
 *
 * Returns a CapabilityProbeResult containing capabilityId, actualStatus,
 * httpStatus, and sampleResponseRef.
 *
 * Dependencies:
 * - `CapabilityContractRegistryV7` from `./manifest-v7.js`
 * - `CapabilityProbeResult` from `../../shared/types/v7-entities.js`
 * - `ProbeActualStatus` from `../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Never probes endpoints not explicitly marked safe.
 * - Never probes capabilities with idempotencyClass = "strict".
 * - HTTP layer is injectable (`httpGet`) for testability.
 *
 * Test coverage: tests/unit/connectors/wet-probe-runner.test.ts
 */
const PROBE_POLICY_DENIED = {
    probeResult: {
        probeResultId: "probe_policy_denied",
        capabilityId: "",
        connectorId: "",
        actualStatus: "unavailable",
        probeConfigRef: "policy:denied",
        createdAt: new Date().toISOString(),
    },
    httpStatus: 0,
};
function resolveProbeConfig(registry, platformId, capabilityId) {
    const resolved = registry.resolveCapability(`${platformId}:${capabilityId}`);
    if (!resolved)
        return undefined;
    const probeConfig = resolved.probeConfig;
    if (!probeConfig)
        return undefined;
    return {
        safeEndpoint: probeConfig.safeEndpoint,
        idempotencyClass: probeConfig.idempotencyClass,
    };
}
function actualStatusFromHttpStatus(status) {
    if (status >= 200 && status < 300)
        return "available";
    if (status === 429 || status === 503)
        return "degraded";
    return "unavailable";
}
export function createWetProbeRunner() {
    const defaultHttpGet = async (url) => {
        const response = await fetch(url, { method: "GET" });
        const body = await response.text().catch(() => undefined);
        return { status: response.status, body };
    };
    return {
        async runWetProbe(platformId, capabilityId, registry, options = {}) {
            const httpGet = options.httpGet ?? defaultHttpGet;
            // 1. Resolve capability and probe config
            const config = resolveProbeConfig(registry, platformId, capabilityId);
            if (!config) {
                return {
                    ...PROBE_POLICY_DENIED,
                    probeResult: {
                        ...PROBE_POLICY_DENIED.probeResult,
                        probeResultId: `probe_no_config:${capabilityId}`,
                        capabilityId,
                        connectorId: platformId,
                        actualStatus: "unavailable",
                        probeConfigRef: "registry:missing",
                        createdAt: new Date().toISOString(),
                    },
                    httpStatus: 0,
                };
            }
            // 2. DR-006: strict side-effect → probe_policy_denied
            if (config.idempotencyClass === "strict") {
                return {
                    ...PROBE_POLICY_DENIED,
                    probeResult: {
                        ...PROBE_POLICY_DENIED.probeResult,
                        probeResultId: `probe_policy_denied:${capabilityId}`,
                        capabilityId,
                        connectorId: platformId,
                        actualStatus: "unavailable",
                        probeConfigRef: config.safeEndpoint,
                        createdAt: new Date().toISOString(),
                    },
                    httpStatus: 0,
                };
            }
            // 3. Execute HTTP GET against safe endpoint
            try {
                const response = await httpGet(config.safeEndpoint);
                const actualStatus = actualStatusFromHttpStatus(response.status);
                return {
                    probeResult: {
                        probeResultId: `probe:${platformId}:${capabilityId}:${Date.now()}`,
                        capabilityId,
                        connectorId: platformId,
                        actualStatus,
                        httpStatus: response.status,
                        sampleResponseRef: response.body
                            ? `probe:body:${Buffer.from(response.body).toString("base64").slice(0, 64)}`
                            : undefined,
                        probeConfigRef: config.safeEndpoint,
                        createdAt: new Date().toISOString(),
                    },
                    httpStatus: response.status,
                };
            }
            catch {
                return {
                    probeResult: {
                        probeResultId: `probe_error:${platformId}:${capabilityId}:${Date.now()}`,
                        capabilityId,
                        connectorId: platformId,
                        actualStatus: "unavailable",
                        probeConfigRef: config.safeEndpoint,
                        createdAt: new Date().toISOString(),
                    },
                    httpStatus: 0,
                };
            }
        },
    };
}
