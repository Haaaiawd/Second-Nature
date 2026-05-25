/**
 * Quiet / reflection orchestration: empty evidence → empty_state; otherwise coverage-gated artifact (T2.3.3).
 *
 * v7 T-V7C.C.3: After a successful Quiet artifact write, if a DreamSchedulePort is provided,
 * automatically trigger scheduleDream(quiet_completion). Skip reason is embedded in HeartbeatCycleResult
 * reasons when the scheduler returns "skipped" (e.g. lock held).
 */
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import { type QuietArtifactAck } from "../../../storage/quiet/quiet-artifact-writer.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";
/**
 * Minimal port for triggering Dream after Quiet completion (T-V7C.C.3).
 * Kept narrow so run-source-backed-quiet does not take a hard dependency on dream-scheduler.
 */
export interface QuietDreamSchedulePort {
    scheduleDream(params: {
        triggerKind: "quiet_completion";
        runId: string;
        traceId: string;
    }): Promise<{
        status: "started" | "skipped" | "queued";
        reason?: string;
    }>;
}
export interface RunSourceBackedQuietParams {
    candidate: CandidateIntent;
    runtime: HeartbeatRuntimeSnapshot;
    day: string;
    userInterestSnapshot?: UserInterestSnapshot;
    workspaceRoot?: string;
    /** v7 T-V7C.C.3: when present, a successful Quiet artifact write auto-triggers Dream scheduling. */
    dreamSchedulePort?: QuietDreamSchedulePort;
}
export interface RunSourceBackedQuietResult {
    result: HeartbeatCycleResult;
    artifactAck?: QuietArtifactAck;
    persistedRelativePath?: string;
}
export declare function runSourceBackedQuiet(params: RunSourceBackedQuietParams): Promise<RunSourceBackedQuietResult>;
