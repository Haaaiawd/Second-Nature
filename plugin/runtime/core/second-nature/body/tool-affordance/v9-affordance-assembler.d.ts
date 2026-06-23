/**
 * v9 AffordanceAssembler — T6.2.1 real-hand affordance baseline.
 *
 * Core logic: Assemble `AffordancePosture` per platform+capability from three
 * independent axes:
 *   - access:      has the capability been registered and credentialed?
 *   - reliability: does recent probe/execution evidence prove it works now?
 *   - familiarity: how much verified history / routine practice exists?
 *
 * Rules:
 *   - Unregistered capability → access=none, reliability=unproven, familiarity=scaffold.
 *   - Registered but no credential → access=needs_auth.
 *   - Registered with credential → access=credentialed.
 *   - Successful probe/execution within 7 days → reliability=proven.
 *   - Failed execution within 7 days → reliability=degraded.
 *   - Only evidence older than 7 days → reliability=stale.
 *   - Active routine for capability → familiarity=routine.
 *   - No routine but >=3 successes → familiarity=practiced.
 *   - Otherwise → familiarity=scaffold.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.1 §4.1 §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (AffordancePosture, SourceRef)
 * - `src/storage/services/tool-experience-store.js` (v7/v8 ToolExperience, CapabilityProbeResult)
 * - `src/storage/v9-state-stores.js` (active ToolRoutine read)
 *
 * Boundary:
 * - Does NOT perform live HTTP probes — reads persisted evidence only.
 * - Does NOT derive write availability from read success.
 * - Scaffold / stale probe cannot masquerade as real-hand available.
 *
 * Test coverage:
 * - tests/unit/body/v9-affordance-posture.test.ts
 * - tests/integration/v9/real-hand-affordance.test.ts
 */
import type { AffordancePosture, AffordanceQuery } from "../../../../shared/types/v9-contracts.js";
import type { StateDatabase } from "../../../../storage/db/index.js";
declare const AFFORDANCE_STALE_PROBE_MS: number;
declare const FAMILIARITY_SUCCESS_THRESHOLD = 3;
export interface CapabilityRef {
    platformId: string;
    capabilityId: string;
    intent?: string;
}
export interface AffordanceRegistryPort {
    listCapabilities(platformId?: string): CapabilityRef[];
}
export interface CredentialPresencePort {
    hasCredential(platformId: string): boolean | Promise<boolean>;
}
export interface AffordanceAssemblerDeps {
    db: StateDatabase;
    registry: AffordanceRegistryPort;
    credentialPresence: CredentialPresencePort;
    now?: string;
}
export declare function assembleToolAffordance(deps: AffordanceAssemblerDeps, query?: AffordanceQuery): Promise<AffordancePosture[]>;
export declare function createStaticRegistry(capabilities: CapabilityRef[]): AffordanceRegistryPort;
export declare function createCredentialPresenceFromVault(vault: {
    loadCredentialContext(platformId: string): Promise<{
        status?: string;
    } | null>;
}): CredentialPresencePort;
export { AFFORDANCE_STALE_PROBE_MS, FAMILIARITY_SUCCESS_THRESHOLD };
