/**
 * v9 ConnectorEvolutionEngine — 7-gate orchestrator + rollback (T6.3.1).
 *
 * Core logic:
 * - `applyConnectorEvolution`: derive target version from plan, run pre-activation
 *   gates (schema → permission → sandbox → fixture → wet_probe → rollback_setup),
 *   activate version, write ledger, run post-activation canary, rollback on fail.
 * - `rollbackConnectorVersion`: restore previous stable version, write rollback ledger.
 * - `buildRollbackCommandHint`: generate human-readable rollback command.
 *
 * Gate order per §4.2 decision tree (authoritative):
 *   Pre-activation:  schema → permission → sandbox → fixture → wet_probe → rollback_setup
 *   Activate version + write ledger
 *   Post-activation: canary → rollback on fail
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.7 §3.8 §3.9 §4.2`
 * - ADR-004: Workspace-only autonomous connector evolution
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (engine contracts)
 * - `src/core/second-nature/body/connector-evolution/v9-connector-evolution-gates.js`
 * - `src/storage/v9-state-stores.js` (via ports)
 *
 * Boundary:
 * - Does NOT execute real adapter code; gate functions are structural validators.
 * - Does NOT modify workspace files; only writes DB rows + ledger entries.
 * - Ledger write is delegated to an injected port.
 *
 * Test coverage:
 * - `tests/unit/connectors/v9-connector-evolution-gates.test.ts`
 * - `tests/integration/v9/connector-evolution-activation.test.ts`
 */
import type { AutonomousChangeKind, ConnectorEvolutionPlan, ConnectorVersion, EvolutionApplyResult, RollbackResult, SourceRef, StageEventSink } from "../../../../shared/types/v9-contracts.js";
import { type GateDeps } from "./v9-connector-evolution-gates.js";
export interface ConnectorVersionStorePort {
    writeVersion(version: ConnectorVersion): Promise<void>;
    readVersionById(versionId: string): Promise<ConnectorVersion | undefined>;
    readActiveVersion(platformId: string): Promise<ConnectorVersion | undefined>;
    updateVersionStatus(versionId: string, status: ConnectorVersion["status"], patch?: Partial<{
        rollbackRef: string;
        rollbackCommandHint: string;
        activatedAt: string;
        rolledBackAt: string;
    }>): Promise<ConnectorVersion | undefined>;
}
export interface LedgerWritePort {
    writeLedgerEntry(entry: {
        id: string;
        workspaceRoot: string;
        changeKind: AutonomousChangeKind;
        targetId: string;
        previousStableRef?: string;
        status?: "proposed" | "gated" | "activated" | "rolled_back" | "blocked";
        gateResultsJson?: string;
        rollbackCommandHint?: string;
        sourceRefs: SourceRef[];
        redactedPayloadJson?: string;
        createdAt: string;
        activatedAt?: string;
    }): Promise<{
        id: string;
    }>;
}
/**
 * Optional file-level rollback hook (T6.3.2).
 * When provided, `rollbackConnectorVersion` will call this after DB-level
 * rollback to swap workspace asset files (manifest/recipe/adapter) from
 * the previous version back over the current version.
 */
export interface FileRollbackPort {
    rollbackFiles(currentAssets: {
        manifestPath?: string;
        recipePath?: string;
        adapterPath?: string;
    }, previousAssets: {
        manifestPath?: string;
        recipePath?: string;
        adapterPath?: string;
    }, workspaceRoot: string): Promise<{
        rolledBack: string[];
        skipped: string[];
    }>;
}
export interface ConnectorEvolutionEngineDeps {
    store: ConnectorVersionStorePort;
    ledger: LedgerWritePort;
    observability: StageEventSink;
    gates: GateDeps;
    /** Optional file-level rollback (T6.3.2). When absent, only DB-level rollback runs. */
    fileRollback?: FileRollbackPort;
    generateId?: () => string;
    now?: () => string;
}
/**
 * Build a human-readable rollback command hint (§3.8 buildRollbackCommandHint).
 */
export declare function buildRollbackCommandHint(platformId: string, currentVersionId: string, previousVersionId: string | undefined): string;
/**
 * Derive a ConnectorVersion from a ConnectorEvolutionPlan (§3.7).
 * Extracts manifestPath, recipePath, adapterPath, declaredCapabilities
 * from plan.payloadJson.
 */
export declare function deriveTargetVersion(plan: ConnectorEvolutionPlan, workspaceRoot: string, generateId: () => string, now: () => string): ConnectorVersion;
export declare function applyConnectorEvolution(plan: ConnectorEvolutionPlan, workspaceRoot: string, deps: ConnectorEvolutionEngineDeps): Promise<EvolutionApplyResult>;
export declare function rollbackConnectorVersion(versionId: string, deps: ConnectorEvolutionEngineDeps): Promise<RollbackResult>;
import type { StateDatabase } from "../../../../storage/db/index.js";
export declare function createStateStoreVersionPort(db: StateDatabase): ConnectorVersionStorePort;
export declare function createStateStoreLedgerPort(db: StateDatabase): LedgerWritePort;
export declare function createFileRollbackPort(): FileRollbackPort;
