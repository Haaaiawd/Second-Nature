import type { OutreachDraftRequest } from "../../../guidance/outreach-draft-schema.js";
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { OutreachJudgment } from "./judge-outreach.js";
import type { DeliveryTargetResolution } from "./delivery-target.js";
export declare function buildOutreachDraftRequest(candidate: CandidateIntent, judgment: OutreachJudgment, snapshot: HeartbeatRuntimeSnapshot, delivery: DeliveryTargetResolution): OutreachDraftRequest;
