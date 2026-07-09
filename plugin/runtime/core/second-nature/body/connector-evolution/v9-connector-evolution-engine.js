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
import { PRE_ACTIVATION_GATES } from "../../../../shared/types/v9-contracts.js";
import { GATE_RUNNERS, parseProposedChanges, } from "./v9-connector-evolution-gates.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function defaultGenerateId() {
    return `cv_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}
/**
 * Map ConnectorPlanType to AutonomousChangeKind for ledger writes.
 */
function planTypeToChangeKind(planType) {
    switch (planType) {
        case "manifest_delta":
            return "connector_manifest_delta";
        case "recipe_delta":
            return "connector_recipe_delta";
        case "adapter_delta":
            return "connector_adapter_delta";
    }
}
/**
 * Build a human-readable rollback command hint (§3.8 buildRollbackCommandHint).
 */
export function buildRollbackCommandHint(platformId, currentVersionId, previousVersionId) {
    if (!previousVersionId) {
        return `rollback ${platformId}:${currentVersionId} (no previous stable)`;
    }
    return `second_nature_ops connector_evolution.rollback --platformId=${platformId} --from=${currentVersionId} --to=${previousVersionId}`;
}
/**
 * Derive a ConnectorVersion from a ConnectorEvolutionPlan (§3.7).
 * Extracts manifestPath, recipePath, adapterPath, declaredCapabilities
 * from plan.payloadJson.
 */
export function deriveTargetVersion(plan, workspaceRoot, generateId, now) {
    const changes = parseProposedChanges(plan);
    const id = generateId();
    return {
        id,
        versionId: `v_${plan.platformId}_${id.slice(-8)}`,
        platformId: plan.platformId,
        workspaceRoot,
        planType: plan.planType,
        manifestPath: changes.manifestPath ?? "",
        recipePath: changes.recipePath,
        adapterPath: changes.adapterPath,
        declaredCapabilities: changes.declaredCapabilities ?? [],
        gateResults: [],
        status: "candidate",
        previousStableRef: plan.previousStableRef,
        sourceRefs: plan.sourceRefs,
        createdAt: now(),
    };
}
// ───────────────────────────────────────────────────────────────
// applyConnectorEvolution (§3.8 + §4.2)
// ───────────────────────────────────────────────────────────────
export async function applyConnectorEvolution(plan, workspaceRoot, deps) {
    const now = deps.now ?? (() => new Date().toISOString());
    const generateId = deps.generateId ?? defaultGenerateId;
    const ts = now();
    // 1. Load previous active version.
    const previous = await deps.store.readActiveVersion(plan.platformId);
    // 2. Derive target version.
    const version = deriveTargetVersion(plan, workspaceRoot, generateId, now);
    version.previousStableRef = previous?.versionId ?? plan.previousStableRef;
    // 3. Run pre-activation gates in §4.2 order.
    const gateResults = [];
    for (const gateName of PRE_ACTIVATION_GATES) {
        const runner = GATE_RUNNERS[gateName];
        const result = await runner(version, plan, deps.gates);
        gateResults.push(result);
        if (!result.passed) {
            // Block: persist candidate version, emit blocked event, return.
            version.gateResults = gateResults;
            version.status = "candidate";
            await deps.store.writeVersion(version);
            await deps.observability.recordStageEvent({
                stage: "connector_evolution",
                platformId: plan.platformId,
                versionId: version.versionId,
                outcome: "blocked",
                reasonCode: `evolution_gate_${gateName}_failed`,
                sourceRefs: plan.sourceRefs,
            });
            return {
                status: "blocked",
                gate: gateName,
                version,
                gateResults,
            };
        }
    }
    // 4. All pre-activation gates passed → activate version.
    version.status = "active";
    version.activatedAt = now();
    version.rollbackCommandHint = buildRollbackCommandHint(plan.platformId, version.versionId, previous?.versionId);
    version.gateResults = gateResults;
    await deps.store.writeVersion(version);
    // Mark previous as rolled_back.
    if (previous) {
        await deps.store.updateVersionStatus(previous.versionId, "rolled_back", {
            rolledBackAt: now(),
        });
    }
    // 5. Write ledger entry.
    const ledgerId = generateId();
    await deps.ledger.writeLedgerEntry({
        id: ledgerId,
        workspaceRoot,
        changeKind: planTypeToChangeKind(plan.planType),
        targetId: version.versionId,
        previousStableRef: version.previousStableRef,
        status: "activated",
        gateResultsJson: JSON.stringify(gateResults),
        rollbackCommandHint: version.rollbackCommandHint,
        sourceRefs: plan.sourceRefs,
        redactedPayloadJson: JSON.stringify({
            declaredCapabilities: version.declaredCapabilities,
        }),
        createdAt: ts,
        activatedAt: now(),
    });
    await deps.observability.recordStageEvent({
        stage: "connector_evolution",
        platformId: plan.platformId,
        versionId: version.versionId,
        outcome: "activated",
        reasonCode: "evolution_activated",
        sourceRefs: plan.sourceRefs,
    });
    // 6. Post-activation canary gate.
    const canaryResult = await GATE_RUNNERS.canary(version, plan, deps.gates);
    gateResults.push(canaryResult);
    if (!canaryResult.passed) {
        // Canary failed → rollback.
        await deps.observability.recordStageEvent({
            stage: "rollback",
            platformId: plan.platformId,
            versionId: version.versionId,
            outcome: "started",
            reasonCode: "evolution_canary_failed",
            sourceRefs: plan.sourceRefs,
        });
        const rollback = await rollbackConnectorVersion(version.versionId, deps);
        return {
            status: rollback.status === "rolled_back" ? "rolled_back" : "blocked",
            version,
            gateResults,
            rollback,
        };
    }
    return {
        status: "active",
        version,
        gateResults,
    };
}
// ───────────────────────────────────────────────────────────────
// rollbackConnectorVersion (§3.9)
// ───────────────────────────────────────────────────────────────
export async function rollbackConnectorVersion(versionId, deps) {
    const now = deps.now ?? (() => new Date().toISOString());
    const generateId = deps.generateId ?? defaultGenerateId;
    const current = await deps.store.readVersionById(versionId);
    if (!current?.previousStableRef) {
        await deps.observability.recordStageEvent({
            stage: "rollback",
            platformId: current?.platformId ?? "unknown",
            versionId,
            outcome: "blocked",
            reasonCode: "no_previous_stable_ref",
            sourceRefs: current?.sourceRefs ?? [],
        });
        return { status: "blocked", reason: "no_previous_stable_ref" };
    }
    const previous = await deps.store.readVersionById(current.previousStableRef);
    if (!previous) {
        await deps.observability.recordStageEvent({
            stage: "rollback",
            platformId: current.platformId,
            versionId,
            outcome: "blocked",
            reasonCode: "previous_version_missing",
            sourceRefs: current.sourceRefs,
        });
        return { status: "blocked", reason: "previous_version_missing" };
    }
    await deps.observability.recordStageEvent({
        stage: "rollback",
        platformId: current.platformId,
        versionId: current.versionId,
        outcome: "started",
        reasonCode: "rollback_started",
        sourceRefs: current.sourceRefs,
    });
    // Roll back current → restore previous.
    await deps.store.updateVersionStatus(current.versionId, "rolled_back", {
        rolledBackAt: now(),
    });
    await deps.store.updateVersionStatus(previous.versionId, "active", {
        activatedAt: now(),
    });
    // Write rollback ledger entry.
    const rollbackHint = buildRollbackCommandHint(current.platformId, current.versionId, previous.versionId);
    const ledgerId = generateId();
    await deps.ledger.writeLedgerEntry({
        id: ledgerId,
        workspaceRoot: current.workspaceRoot,
        changeKind: planTypeToChangeKind(current.planType),
        targetId: current.versionId,
        previousStableRef: previous.versionId,
        status: "rolled_back",
        gateResultsJson: JSON.stringify([{ gate: "rollback", passed: true }]),
        rollbackCommandHint: rollbackHint,
        sourceRefs: current.sourceRefs,
        redactedPayloadJson: JSON.stringify({ reason: "canary_failure" }),
        createdAt: now(),
        activatedAt: now(),
    });
    // T6.3.2: File-level rollback — swap workspace asset files from previous version.
    let fileRollbackResult;
    if (deps.fileRollback) {
        try {
            fileRollbackResult = await deps.fileRollback.rollbackFiles({
                manifestPath: current.manifestPath,
                recipePath: current.recipePath,
                adapterPath: current.adapterPath,
            }, {
                manifestPath: previous.manifestPath,
                recipePath: previous.recipePath,
                adapterPath: previous.adapterPath,
            }, current.workspaceRoot);
            await deps.observability.recordStageEvent({
                stage: "rollback",
                platformId: current.platformId,
                versionId: current.versionId,
                outcome: "ok",
                reasonCode: "file_rollback_completed",
                sourceRefs: current.sourceRefs,
            });
        }
        catch (err) {
            // File rollback failure is non-fatal — DB-level rollback already succeeded.
            // Log and continue; operator can manually restore files using rollbackCommandHint.
            await deps.observability.recordStageEvent({
                stage: "rollback",
                platformId: current.platformId,
                versionId: current.versionId,
                outcome: "ok",
                reasonCode: "file_rollback_failed_db_rollback_succeeded",
                sourceRefs: current.sourceRefs,
            });
        }
    }
    await deps.observability.recordStageEvent({
        stage: "rollback",
        platformId: current.platformId,
        versionId: current.versionId,
        outcome: "ok",
        reasonCode: "rollback_succeeded",
        sourceRefs: current.sourceRefs,
    });
    return {
        status: "rolled_back",
        restoredVersionId: previous.versionId,
        fileRollback: fileRollbackResult,
    };
}
import { writeConnectorVersion, readConnectorVersionById, readActiveConnectorVersion, updateConnectorVersionStatus, } from "../../../../storage/v9-state-stores.js";
function storageRowToVersion(row) {
    let assetPaths = {};
    if (row.assetPathsJson) {
        try {
            const parsed = JSON.parse(row.assetPathsJson);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                assetPaths = parsed;
            }
        }
        catch {
            assetPaths = {};
        }
    }
    let declaredCapabilities = [];
    if (row.declaredCapabilitiesJson) {
        try {
            const parsed = JSON.parse(row.declaredCapabilitiesJson);
            if (Array.isArray(parsed))
                declaredCapabilities = parsed;
        }
        catch {
            declaredCapabilities = [];
        }
    }
    let payload = {};
    if (row.payloadJson) {
        try {
            const parsed = JSON.parse(row.payloadJson);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                payload = parsed;
            }
        }
        catch {
            payload = {};
        }
    }
    let sourceRefs = [];
    if (row.sourceRefsJson) {
        try {
            const parsed = JSON.parse(row.sourceRefsJson);
            if (Array.isArray(parsed))
                sourceRefs = parsed;
        }
        catch {
            sourceRefs = [];
        }
    }
    return {
        id: row.id,
        versionId: row.versionId,
        platformId: row.platformId,
        workspaceRoot: payload.workspaceRoot ?? "",
        planType: payload.planType ?? "manifest_delta",
        manifestPath: assetPaths.manifestPath ?? "",
        recipePath: assetPaths.recipePath,
        adapterPath: assetPaths.adapterPath,
        declaredCapabilities,
        gateResults: Array.isArray(payload.gateResults)
            ? payload.gateResults
            : [],
        status: row.status,
        previousStableRef: row.previousStableRef ?? undefined,
        rollbackRef: row.rollbackRef ?? undefined,
        rollbackCommandHint: row.rollbackCommandHint ?? undefined,
        sourceRefs,
        createdAt: row.createdAt,
        activatedAt: row.activatedAt ?? undefined,
        rolledBackAt: row.rolledBackAt ?? undefined,
    };
}
export function createStateStoreVersionPort(db) {
    return {
        async writeVersion(version) {
            await writeConnectorVersion(db, {
                id: version.id,
                createdAt: version.createdAt,
                platformId: version.platformId,
                versionId: version.versionId,
                manifestPath: version.manifestPath,
                recipePath: version.recipePath,
                adapterPath: version.adapterPath,
                declaredCapabilities: version.declaredCapabilities,
                status: version.status,
                previousStableRef: version.previousStableRef,
                rollbackRef: version.rollbackRef,
                rollbackCommandHint: version.rollbackCommandHint,
                sourceRefs: version.sourceRefs,
                workspaceRoot: version.workspaceRoot,
                planType: version.planType,
                gateResults: version.gateResults,
                activatedAt: version.activatedAt,
                rolledBackAt: version.rolledBackAt,
            });
        },
        async readVersionById(versionId) {
            const row = await readConnectorVersionById(db, versionId);
            if (!row)
                return undefined;
            return storageRowToVersion(row);
        },
        async readActiveVersion(platformId) {
            const row = await readActiveConnectorVersion(db, platformId);
            if (!row)
                return undefined;
            return storageRowToVersion(row);
        },
        async updateVersionStatus(versionId, status, patch) {
            const row = await updateConnectorVersionStatus(db, versionId, status, patch);
            if (!row)
                return undefined;
            return storageRowToVersion(row);
        },
    };
}
/**
 * State-store backed ledger write port.
 * Reuses the same writeAutonomousChangeLedger from v9-state-stores.
 */
import { writeAutonomousChangeLedger } from "../../../../storage/v9-state-stores.js";
export function createStateStoreLedgerPort(db) {
    return {
        async writeLedgerEntry(entry) {
            const row = await writeAutonomousChangeLedger(db, {
                id: entry.id,
                createdAt: entry.createdAt,
                workspaceRoot: entry.workspaceRoot,
                changeKind: entry.changeKind,
                targetId: entry.targetId,
                previousStableRef: entry.previousStableRef,
                status: entry.status,
                gateResultsJson: entry.gateResultsJson,
                rollbackCommandHint: entry.rollbackCommandHint,
                sourceRefs: entry.sourceRefs,
                redactedPayloadJson: entry.redactedPayloadJson,
                activatedAt: entry.activatedAt,
            });
            return { id: row.id };
        },
    };
}
/**
 * File-system backed file rollback port (T6.3.2).
 * Uses `rollbackConnectorFiles` from v9-connector-file-ops to swap
 * workspace asset files from the previous version.
 */
import { rollbackConnectorFiles } from "./v9-connector-file-ops.js";
export function createFileRollbackPort() {
    return {
        async rollbackFiles(currentAssets, previousAssets, workspaceRoot) {
            return rollbackConnectorFiles(currentAssets, previousAssets, workspaceRoot);
        },
    };
}
