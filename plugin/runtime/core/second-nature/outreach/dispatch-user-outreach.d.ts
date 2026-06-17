/**
 * User outreach dispatch path: judgment → draft → host delivery → attempt + operator fallback (T2.3.2).
 * Mirrors control-plane-system.detail §3.9 dispatchAllowedIntent user_outreach branch.
 */
import type { GuidanceDraftPort } from "../../../guidance/outreach-draft-schema.js";
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { HeartbeatCycleResult } from "../heartbeat/signal.js";
import type { StateDatabase } from "../../../storage/db/index.js";
import type { LifeEvidenceSourceRef } from "../../../storage/life-evidence/types.js";
import { type JudgeOutreachInput } from "./judge-outreach.js";
import { type DeliveryTargetResolution } from "./delivery-target.js";
export interface OpenClawDeliverySendResult {
    id: string;
    status: "sent" | "failed" | "dropped_by_host_policy";
    errorClass?: string;
    messageId?: string;
    /** Host-reported delivery proof when messageId is absent (T4.3.1). */
    hostProofRef?: LifeEvidenceSourceRef;
}
export interface OpenClawDeliveryPort {
    sendDeliveryRequest(input: {
        decisionId: string;
        target: NonNullable<DeliveryTargetResolution["target"]>;
        channel: string;
        recipient?: string;
        message: string;
        sourceRefs: CandidateIntent["sourceRefs"];
    }): Promise<OpenClawDeliverySendResult>;
}
export declare function dispatchUserOutreachIntent(input: {
    candidate: CandidateIntent;
    snapshot: HeartbeatRuntimeSnapshot;
    judgeInput: Omit<JudgeOutreachInput, "candidate">;
    guidance: GuidanceDraftPort;
    delivery: OpenClawDeliveryPort;
    state: StateDatabase;
}): Promise<HeartbeatCycleResult>;
