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
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { safeReadJson, safeReadYaml } from "./v9-connector-file-ops.js";
// ───────────────────────────────────────────────────────────────
// migrateV8ConnectorManifest (§3.11)
// ───────────────────────────────────────────────────────────────
function defaultGenerateId() {
    return `cv_mig_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
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
export async function migrateV8ConnectorManifest(workspaceRoot, manifestPath, deps) {
    const now = deps.now ?? (() => new Date().toISOString());
    const generateId = deps.generateId ?? defaultGenerateId;
    // Read manifest (JSON or YAML based on extension).
    let manifest;
    if (manifestPath.endsWith(".json")) {
        manifest = await safeReadJson(join(workspaceRoot, manifestPath));
    }
    else if (manifestPath.endsWith(".yaml") || manifestPath.endsWith(".yml")) {
        manifest = await safeReadYaml(join(workspaceRoot, manifestPath));
    }
    if (!manifest || !manifest.platformId)
        return undefined;
    // Check if a v9 ConnectorVersion already exists for this platform.
    const existing = await deps.store.readActiveVersion(manifest.platformId);
    if (existing)
        return undefined;
    // Also check if a migrated version already exists.
    const migratedVersionId = `${manifest.platformId}-v8-migrated`;
    const existingMigrated = await deps.store.readVersionById(migratedVersionId);
    if (existingMigrated)
        return undefined;
    // Build gate results: schema/permission/sandbox passed, fixture/wet_probe/canary pending.
    const sourceRefs = [
        { family: "connector", id: manifestPath, label: "v8_migration" },
    ];
    const gateResults = [
        { gate: "schema", passed: true, evidenceRefs: sourceRefs },
        { gate: "permission", passed: true, evidenceRefs: sourceRefs },
        { gate: "sandbox", passed: true, evidenceRefs: sourceRefs },
        { gate: "fixture", passed: false, reason: "migration_no_fixture", evidenceRefs: sourceRefs },
        { gate: "wet_probe", passed: false, reason: "migration_probe_pending", evidenceRefs: sourceRefs },
        { gate: "rollback_setup", passed: false, reason: "not_run", evidenceRefs: sourceRefs },
        { gate: "canary", passed: false, reason: "not_run", evidenceRefs: sourceRefs },
    ];
    const version = {
        id: generateId(),
        versionId: migratedVersionId,
        platformId: manifest.platformId,
        workspaceRoot,
        planType: "manifest_delta",
        manifestPath,
        recipePath: manifest.recipePath,
        adapterPath: manifest.adapterPath,
        declaredCapabilities: manifest.capabilities.map((c) => typeof c === "string" ? c : c.capabilityId),
        gateResults,
        status: "candidate",
        sourceRefs,
        createdAt: now(),
    };
    await deps.store.writeVersion(version);
    return version;
}
// ───────────────────────────────────────────────────────────────
// scanAndMigrateV8Manifests
// ───────────────────────────────────────────────────────────────
/**
 * Scan `.second-nature/connectors/<platform>/manifest.{json,yaml,yml}` and migrate
 * all v8 manifests that don't already have a v9 ConnectorVersion.
 *
 * Returns the list of migrated ConnectorVersions (empty if none found).
 */
export async function scanAndMigrateV8Manifests(workspaceRoot, deps) {
    const connectorsDir = join(workspaceRoot, ".second-nature", "connectors");
    const migrated = [];
    let platformDirs;
    try {
        platformDirs = await fs.readdir(connectorsDir);
    }
    catch {
        // No connectors directory — nothing to migrate.
        return [];
    }
    for (const platformDir of platformDirs) {
        const platformPath = join(connectorsDir, platformDir);
        let stat;
        try {
            stat = await fs.stat(platformPath);
        }
        catch {
            continue;
        }
        if (!stat.isDirectory())
            continue;
        // Try manifest.json, then manifest.yaml, then manifest.yml.
        const manifestCandidates = [
            `.second-nature/connectors/${platformDir}/manifest.json`,
            `.second-nature/connectors/${platformDir}/manifest.yaml`,
            `.second-nature/connectors/${platformDir}/manifest.yml`,
        ];
        for (const manifestPath of manifestCandidates) {
            const version = await migrateV8ConnectorManifest(workspaceRoot, manifestPath, deps);
            if (version) {
                migrated.push(version);
                break; // Only migrate the first found manifest per platform.
            }
        }
    }
    return migrated;
}
