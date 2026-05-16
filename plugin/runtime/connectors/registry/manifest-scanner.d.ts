export interface ManifestScanResult {
    path: string;
    content: string;
}
/**
 * Enumerate `.second-nature/connectors/{platformId}/manifest.yaml` under workspace root.
 * Does not execute any code; only reads file paths and contents.
 */
export declare function scanConnectorManifests(workspaceRoot: string): ManifestScanResult[];
