/**
 * Writes validated Quiet artifact JSON under workspace `.second-nature/quiet/{day}/` (CR-M3 / T2.3.3).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { QuietArtifactWrite } from "./quiet-artifact-types.js";
import type { QuietArtifactAck } from "./quiet-artifact-writer.js";

export interface PersistQuietArtifactResult {
  relativePath: string;
  absolutePath: string;
}

export async function persistQuietArtifactToWorkspace(
  workspaceRoot: string,
  ack: QuietArtifactAck,
  input: QuietArtifactWrite,
): Promise<PersistQuietArtifactResult> {
  const dir = path.join(workspaceRoot, ".second-nature", "quiet", input.day);
  await fs.mkdir(dir, { recursive: true });
  const fileName = input.kind === "empty_state" ? "empty_state.json" : `${ack.artifactId}.json`;
  const file = path.join(dir, fileName);
  const payload = {
    artifactId: ack.artifactId,
    artifactRef: ack.artifactRef,
    sourceCoverage: ack.sourceCoverage,
    write: input,
    persistedAt: new Date().toISOString(),
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return {
    relativePath: path.relative(workspaceRoot, file),
    absolutePath: file,
  };
}
