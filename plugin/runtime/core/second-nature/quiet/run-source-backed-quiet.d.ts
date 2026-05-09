/**
 * Quiet / reflection orchestration: empty evidence → empty_state; otherwise coverage-gated artifact (T2.3.3).
 */
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import { type QuietArtifactAck } from "../../../storage/quiet/quiet-artifact-writer.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";
export interface RunSourceBackedQuietParams {
    candidate: CandidateIntent;
    runtime: HeartbeatRuntimeSnapshot;
    day: string;
    userInterestSnapshot?: UserInterestSnapshot;
    workspaceRoot?: string;
}
export interface RunSourceBackedQuietResult {
    result: HeartbeatCycleResult;
    artifactAck?: QuietArtifactAck;
    persistedRelativePath?: string;
}
export declare function runSourceBackedQuiet(params: RunSourceBackedQuietParams): Promise<RunSourceBackedQuietResult>;
