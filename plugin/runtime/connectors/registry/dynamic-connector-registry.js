import path from "node:path";
import { parseConnectorManifestV6, toValidationError } from "../manifest/manifest-parser.js";
import { classifyTrust, isExecutable } from "./trust-policy.js";
import { scanConnectorManifests } from "./manifest-scanner.js";
export function createRegistrySnapshotStore(initial) {
    let active = initial ??
        buildSnapshot(new Map(), new Map(), [], [], new Date().toISOString());
    return {
        getActive() {
            return active;
        },
        swap(snapshot) {
            active = snapshot;
        },
    };
}
function buildSnapshot(builtIn, dynamic, conflicts, validationErrors, createdAt) {
    const entries = new Map();
    for (const [k, v] of builtIn)
        entries.set(k, v);
    for (const [k, v] of dynamic)
        entries.set(k, v);
    return Object.freeze({
        entries,
        builtInEntries: builtIn,
        dynamicEntries: dynamic,
        conflicts: Object.freeze([...conflicts]),
        validationErrors: Object.freeze([...validationErrors]),
        createdAt,
    });
}
function manifestToInventoryEntry(manifest, source, manifestPath) {
    const trustStatus = classifyTrust(manifest);
    return {
        platformId: manifest.platformId,
        source,
        manifestPath,
        trustStatus,
        executable: isExecutable(trustStatus),
        capabilities: manifest.capabilities.map((c) => c.id),
        validationErrors: [],
    };
}
/**
 * DynamicConnectorRegistry scans workspace manifests, validates, classifies trust,
 * merges built-in entries, applies fail-closed conflict policy, and publishes
 * immutable registry snapshots.
 */
export class DynamicConnectorRegistry {
    builtInManifests;
    snapshotStore;
    constructor(options) {
        this.builtInManifests = options.builtInManifests ?? [];
        this.snapshotStore = options.snapshotStore;
    }
    /**
     * Reload connectors from workspace root.
     * Scans `.second-nature/connectors/{platformId}/manifest.yaml`, validates,
     * classifies trust, and atomically swaps the active registry snapshot.
     */
    reloadConnectors(workspaceRoot) {
        const scannedFiles = scanConnectorManifests(workspaceRoot);
        const scanned = scannedFiles.length;
        const builtInMap = new Map();
        for (const manifest of this.builtInManifests) {
            builtInMap.set(manifest.platformId, manifestToInventoryEntry(manifest, "built_in"));
        }
        const dynamicMap = new Map();
        const conflicts = [];
        const validationErrors = [];
        let registered = 0;
        let skipped = 0;
        for (const file of scannedFiles) {
            const parseResult = parseConnectorManifestV6(file.content, file.path);
            if (!parseResult.ok) {
                validationErrors.push(...toValidationError(file.path, parseResult));
                skipped++;
                continue;
            }
            const manifest = parseResult.manifest;
            const manifestPath = path.relative(workspaceRoot, file.path);
            // Duplicate platformId without override -> fail-closed
            if (builtInMap.has(manifest.platformId) || dynamicMap.has(manifest.platformId)) {
                const existing = builtInMap.get(manifest.platformId) ?? dynamicMap.get(manifest.platformId);
                const allowOverride = manifest.trust?.override === true;
                const isTrustedSource = existing.source === "built_in";
                if (!allowOverride || isTrustedSource) {
                    conflicts.push({
                        platformId: manifest.platformId,
                        existingSource: existing.source,
                        attemptedSource: "workspace",
                        reason: allowOverride
                            ? "override_rejected_trusted_source"
                            : "duplicate_platform_id_without_override",
                    });
                    skipped++;
                    continue;
                }
            }
            const entry = manifestToInventoryEntry(manifest, "workspace", manifestPath);
            dynamicMap.set(manifest.platformId, entry);
            registered++;
        }
        const snapshot = buildSnapshot(builtInMap, dynamicMap, conflicts, validationErrors, new Date().toISOString());
        this.snapshotStore.swap(snapshot);
        return {
            scanned,
            registered,
            skipped,
            conflicts,
            validationErrors,
        };
    }
    getActiveRegistrySnapshot() {
        return this.snapshotStore.getActive();
    }
    listConnectors() {
        return [...this.snapshotStore.getActive().entries.values()];
    }
    describeConnector(platformId) {
        return this.snapshotStore.getActive().entries.get(platformId);
    }
}
