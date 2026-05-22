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
import type { CapabilityContractRegistryV7 } from "./manifest-v7.js";
import type { CapabilityProbeResult } from "../../shared/types/v7-entities.js";
export type HttpGetFn = (url: string) => Promise<{
    status: number;
    body?: string;
}>;
export interface WetProbeResult {
    probeResult: CapabilityProbeResult;
    httpStatus: number;
}
export interface WetProbeRunner {
    runWetProbe(platformId: string, capabilityId: string, registry: CapabilityContractRegistryV7, options?: {
        httpGet?: HttpGetFn;
    }): Promise<WetProbeResult>;
}
export declare function createWetProbeRunner(): WetProbeRunner;
