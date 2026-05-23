/**
 * AffordanceAssembler — T-BTS.C.1
 *
 * Core logic: Assemble a platform→capability affordance map from the v7
 * capability registry and recent probe results.
 *
 * Mapping rules (probe actualStatus → affordance status):
 * - available  → safe
 * - degraded   → exploratory
 * - unavailable → unavailable
 * - no probe + credential required → needs_auth
 * - no probe + no credential required → unavailable
 *
 * Caching:
 * - TTL cache (default 30s) keyed by serialized scope.
 * - Invalidate on explicit call or when underlying data changes.
 *
 * Performance target: P95 < 1s for 50 manifests.
 *
 * Dependencies:
 * - `CapabilityContractRegistryV7` from `../../../../connectors/base/manifest-v7.js`
 * - `AffordanceItem`, `AffordanceMap`, `AffordanceContextScope`
 *   from `../../../../shared/types/v7-entities.js`
 * - `applyAffordanceContextScope` from `./affordance-context-scope.js`
 *
 * Boundary:
 * - Does NOT perform HTTP probes — reads cached probe results only.
 * - Credential-bearing entries are excluded (ADR-003).
 * - Returns a plain object; caller decides persistence.
 *
 * Test coverage: tests/unit/body/affordance-assembler.test.ts
 */
import type { CapabilityContractRegistryV7 } from "../../../../connectors/base/manifest-v7.js";
import type { AffordanceMap, AffordanceContextScope, ProbeActualStatus } from "../../../../shared/types/v7-entities.js";
export interface ProbeResultReader {
    getLatestProbeResult(platformId: string, capabilityId: string): {
        actualStatus: ProbeActualStatus;
        createdAt: string;
    } | undefined;
}
export interface AffordanceAssembler {
    assembleAffordanceMap(scope?: AffordanceContextScope): Promise<AffordanceMap>;
    invalidateCache(): void;
}
export interface AffordanceAssemblerOptions {
    registry: CapabilityContractRegistryV7;
    probeReader: ProbeResultReader;
    credentialRequired?: (platformId: string, capabilityId: string) => boolean;
    ttlMs?: number;
}
export declare function createAffordanceAssembler(options: AffordanceAssemblerOptions): AffordanceAssembler;
