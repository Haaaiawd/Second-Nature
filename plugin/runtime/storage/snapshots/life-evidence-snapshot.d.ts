import type { StateDatabase } from "../db/index.js";
import type { LifeEvidenceQuery, LifeEvidenceSnapshot } from "./types.js";
export interface LoadLifeEvidenceSnapshotOptions {
    runRepairGate?: boolean;
}
export declare function loadLifeEvidenceSnapshot(state: StateDatabase, workspaceRoot: string, query: LifeEvidenceQuery, options?: LoadLifeEvidenceSnapshotOptions): Promise<LifeEvidenceSnapshot>;
