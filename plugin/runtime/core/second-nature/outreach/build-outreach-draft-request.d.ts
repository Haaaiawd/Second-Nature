import type { OutreachDraftRequest } from "../../../guidance/outreach-draft-schema.js";
import type { CandidateIntent } from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { OutreachJudgment } from "./judge-outreach.js";
import type { DeliveryTargetResolution } from "./delivery-target.js";
import type { NarrativeState } from "../../../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../../../storage/relationship/relationship-memory-store.js";
export declare function buildOutreachDraftRequest(candidate: CandidateIntent, judgment: OutreachJudgment, snapshot: HeartbeatRuntimeSnapshot, delivery: DeliveryTargetResolution, narrativeState?: NarrativeState, relationshipMemory?: RelationshipMemory): OutreachDraftRequest;
