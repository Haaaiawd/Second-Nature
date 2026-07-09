/**
 * v9 Connector Evolution 7-Gate implementations (T6.3.1).
 *
 * Gate order per §4.2 decision tree (authoritative):
 *   Pre-activation:  schema → permission → sandbox → fixture → wet_probe → rollback_setup
 *   Post-activation: canary
 *
 * Each gate is a pure async function that receives the derived ConnectorVersion
 * + the original ConnectorEvolutionPlan + gate deps, and returns a GateResult.
 * Gates are intentionally lightweight structural validators in T6.3.1;
 * real adapter execution (fixture run, wet probe network call) is owned by
 * T6.3.2 connector rollback & v8 manifest migration.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.8 §4.2 §5`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1`
 * - ADR-004: Workspace-only autonomous connector evolution
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (gate + version + plan types)
 *
 * Boundary:
 * - Pure functions; no DB access, no filesystem, no network.
 * - Gate deps are injected for testability.
 *
 * Test coverage: `tests/unit/connectors/v9-connector-evolution-gates.test.ts`
 */
import type { ConnectorEvolutionPlan, ConnectorVersion, GateResult } from "../../../../shared/types/v9-contracts.js";
/**
 * Injected dependencies for gate execution.
 * Each optional dep enables a specific gate's real check;
 * if a dep is missing, the gate returns a structural-only pass.
 */
export interface GateDeps {
    /** Returns the set of capabilities the platform is allowed to declare. */
    getAllowedPlatformCapabilities?: (platformId: string) => string[];
    /** Returns true if the adapter path contains forbidden module references. */
    checkAdapterSandboxSafety?: (adapterPath: string) => {
        safe: boolean;
        reason?: string;
    };
    /** Returns fixture data for the platform, or undefined if no fixture exists. */
    getFixtureData?: (platformId: string) => unknown | undefined;
    /** Returns wet-probe configuration, or undefined if not configured. */
    getWetProbeConfig?: (platformId: string) => {
        endpoint: string;
        capability: string;
    } | undefined;
    /** Returns the previous stable version id, or undefined. */
    getPreviousStableVersionId?: (platformId: string) => string | undefined;
    /** Returns true if the activated version passes post-activation health check. */
    checkCanaryHealth?: (platformId: string, versionId: string) => {
        healthy: boolean;
        reason?: string;
    };
}
/**
 * Parse plan.payloadJson to extract proposed changes.
 * The payload structure (per §3.7 deriveTargetVersion):
 * { manifestPath, recipePath?, adapterPath?, declaredCapabilities? }
 */
export interface ProposedChanges {
    manifestPath?: string;
    recipePath?: string;
    adapterPath?: string;
    declaredCapabilities?: string[];
}
export declare function parseProposedChanges(plan: ConnectorEvolutionPlan): ProposedChanges;
/**
 * Validate that the plan payload has a valid structure:
 * - manifestPath is a non-empty string
 * - declaredCapabilities is an array (possibly empty)
 */
export declare function runSchemaGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, _deps: GateDeps): Promise<GateResult>;
/**
 * Validate that declared capabilities don't expand beyond the platform's
 * allowed scope. If no allowed-capabilities provider is injected, falls back
 * to structural check (capabilities must match platformId prefix).
 */
export declare function runPermissionGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
/**
 * Validate that the adapter code doesn't reference forbidden modules.
 * If an adapter sandbox safety checker is injected, uses it;
 * otherwise falls back to static pattern scan of adapterPath content.
 */
export declare function runSandboxGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
/**
 * Validate that fixture data exists for the platform.
 * In T6.3.1 this is a structural check; T6.3.2 will run the adapter
 * against the fixture in a sandboxed worker.
 */
export declare function runFixtureGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
/**
 * Validate that wet-probe configuration exists for the platform.
 * In T6.3.1 this is a structural check; T6.3.2 will execute the real
 * read-only probe against the endpoint.
 */
export declare function runWetProbeGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
/**
 * Validate that a rollback path exists:
 * - If previousStableRef is set, it must resolve to a real version.
 * - If no previous stable, the rollbackCommandHint must indicate "no previous stable".
 */
export declare function runRollbackSetupGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
/**
 * Post-activation canary health check.
 * Runs after the version is activated; failure triggers rollback.
 * In T6.3.1 this is a structural check; T6.3.2 will run real health probes.
 */
export declare function runCanaryGate(version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps): Promise<GateResult>;
export type GateRunner = (version: ConnectorVersion, plan: ConnectorEvolutionPlan, deps: GateDeps) => Promise<GateResult>;
export declare const GATE_RUNNERS: Record<string, GateRunner>;
