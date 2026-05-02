import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { StateDatabase } from "../db/index.js";
import type { ContinuitySnapshot } from "./types.js";
export interface LoadContinuitySnapshotParams {
    state: StateDatabase;
    workspaceRoot: string;
    observability?: ObservabilityDatabase;
}
export declare function loadContinuitySnapshot(params: LoadContinuitySnapshotParams): Promise<ContinuitySnapshot>;
