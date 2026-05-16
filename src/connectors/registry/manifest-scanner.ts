import fs from "node:fs";
import path from "node:path";

export interface ManifestScanResult {
  path: string;
  content: string;
}

/**
 * Enumerate `.second-nature/connectors/{platformId}/manifest.yaml` under workspace root.
 * Does not execute any code; only reads file paths and contents.
 */
export function scanConnectorManifests(workspaceRoot: string): ManifestScanResult[] {
  const connectorsDir = path.join(workspaceRoot, ".second-nature", "connectors");
  if (!fs.existsSync(connectorsDir)) {
    return [];
  }

  const results: ManifestScanResult[] = [];
  const entries = fs.readdirSync(connectorsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(connectorsDir, entry.name, "manifest.yaml");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const content = fs.readFileSync(manifestPath, "utf-8");
      results.push({ path: manifestPath, content });
    } catch {
      // Skip unreadable files; validation layer will not see them
    }
  }

  return results;
}
