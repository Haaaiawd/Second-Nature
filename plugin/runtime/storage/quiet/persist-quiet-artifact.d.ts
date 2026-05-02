import type { QuietArtifactWrite } from "./quiet-artifact-types.js";
import type { QuietArtifactAck } from "./quiet-artifact-writer.js";
export interface PersistQuietArtifactResult {
    relativePath: string;
    absolutePath: string;
}
export declare function persistQuietArtifactToWorkspace(workspaceRoot: string, ack: QuietArtifactAck, input: QuietArtifactWrite): Promise<PersistQuietArtifactResult>;
