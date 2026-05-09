import type { SnapshotInputs } from "../heartbeat/snapshot-builder.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { CandidateIntent } from "../types.js";
import type { JudgeOutreachInput, JudgeOutreachUserInterest } from "./judge-outreach.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";
export declare function userInterestSnapshotToJudge(snapshot?: UserInterestSnapshot): JudgeOutreachUserInterest;
export declare function buildJudgeOutreachInputFromSnapshot(intent: CandidateIntent, runtime: HeartbeatRuntimeSnapshot, inputs: SnapshotInputs): Omit<JudgeOutreachInput, "candidate">;
