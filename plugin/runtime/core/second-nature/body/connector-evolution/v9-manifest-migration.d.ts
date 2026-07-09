/**
 * v9 V8 connector manifest migration (T6.3.2).
 *
 * Core logic:
 * - `V8ConnectorManifest`: interface for v8 manifest structure.
 * - `migrateV8ConnectorManifest`: convert a single v8 manifest to a candidate
 *   ConnectorVersion with fixture/wet_probe gates pending.
 * - `scanAndMigrateV8Manifests`: scan `.second-nature/connectors/<platform>/manifest.{json,yaml}`
 *   and migrate all v8 manifests that don't already have a v9 ConnectorVersion.
 *
 * Migration semantics (§3.11):
 * - v8 manifest → `candidate` status only; NOT auto-activated.
 * - fixtureGate / wetProbeGate / canaryGate default to not-passed, forcing
 *   re-validation on next probe/evolution cycle.
 * - Platforms with existing v9 ConnectorVersion are skipped.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.11`
 * - ADR-004: Workspace-only autonomous connector evolution
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (ConnectorVersion, GateResult)
 * - `src/core/second-nature/body/connector-evolution/v9-connector-file-ops.js`
 * - `src/storage/v9-state-stores.js` (via ports)
 *
 * Boundary:
 * - Reads workspace files (manifest.json / manifest.yaml).
 * - Writes DB rows (ConnectorVersion) via injected port.
 * - Does NOT modify workspace files.
 *
 * Test coverage: `tests/integration/connectors/v9-manifest-migration.test.ts`
 */
import type { ConnectorVersion } from "../../../../shared/types/v9-contracts.js";
export interface V8ConnectorManifest {
    platformId: string;
    capabilities: Array<string | {
        capabilityId: string;
        description?: string;
    }>;
    runner?: {
        kind: string;
        config?: Record<string, unknown>;
    };
    recipePath?: string;
    adapterPath?: string;
}
export interface ManifestMigrationPort {
    writeVersion(version: ConnectorVersion): Promise<void>;
    readActiveVersion(platformId: string): Promise<ConnectorVersion | undefined>;
    readVersionById(versionId: string): Promise<ConnectorVersion | undefined>;
}
export interface ManifestMigrationDeps {
    store: ManifestMigrationPort;
    generateId?: () => string;
    now?: () => string;
}
/**
 * Migrate a single v8 manifest file to a candidate ConnectorVersion.
 *
 * The manifest can be JSON (.json) or YAML (.yaml/.yml).
 * Returns undefined if the manifest is missing or malformed.
 *
 * Migration semantics:
 * - Status = "candidate" (NOT active)
 * - schema/permission/sandbox gates = passed (structural)
 * - fixture/wet_probe/canary gates = not-passed (pending re-validation)
 */
export declare function migrateV8ConnectorManifest(workspaceRoot: string, manifestPath: string, deps: ManifestMigrationDeps): Promise<ConnectorVersion | undefined>;
/**
 * Scan `.second-nature/connectors/<platform>/manifest.{json,yaml,yml}` and migrate
 * all v8 manifests that don't already have a v9 ConnectorVersion.
 *
 * Returns the list of migrated ConnectorVersions (empty if none found).
 */
export declare function scanAndMigrateV8Manifests(workspaceRoot: string, deps: ManifestMigrationDeps): Promise<ConnectorVersion[]>;
