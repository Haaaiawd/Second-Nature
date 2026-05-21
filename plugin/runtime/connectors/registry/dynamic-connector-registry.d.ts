import { type ConnectorManifestV6, type ConnectorInventoryEntry, type ConnectorReloadResult, type ConnectorRegistrySnapshot } from "../manifest/manifest-schema.js";
export interface RegistrySnapshotStore {
    getActive(): ConnectorRegistrySnapshot;
    swap(snapshot: ConnectorRegistrySnapshot): void;
}
export declare function createRegistrySnapshotStore(initial?: ConnectorRegistrySnapshot): RegistrySnapshotStore;
export interface DynamicConnectorRegistryOptions {
    builtInManifests?: ConnectorManifestV6[];
    snapshotStore: RegistrySnapshotStore;
}
/**
 * DynamicConnectorRegistry scans workspace manifests, validates, classifies trust,
 * merges built-in entries, applies fail-closed conflict policy, and publishes
 * immutable registry snapshots.
 */
export declare class DynamicConnectorRegistry {
    private readonly builtInManifests;
    private readonly snapshotStore;
    constructor(options: DynamicConnectorRegistryOptions);
    /**
     * Reload connectors from workspace root.
     * Scans `.second-nature/connectors/{platformId}/manifest.yaml`, validates,
     * classifies trust, and atomically swaps the active registry snapshot.
     */
    reloadConnectors(workspaceRoot: string): ConnectorReloadResult;
    getActiveRegistrySnapshot(): ConnectorRegistrySnapshot;
    listConnectors(): ConnectorInventoryEntry[];
    describeConnector(platformId: string): ConnectorInventoryEntry | undefined;
}
