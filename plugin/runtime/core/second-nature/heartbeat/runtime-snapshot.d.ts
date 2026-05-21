/**
 * HeartbeatRuntimeSnapshot assembly for candidate planner + hard guards (T2.1.3, T2.2.1).
 */
import type { ContinuitySnapshot, ControlPlaneSourceRef } from "../types.js";
import type { RhythmPolicy } from "../rhythm/rhythm-policy.js";
import { type PlannerRhythmWindowSlice } from "../rhythm/planner-rhythm-window.js";
import type { SnapshotInputs } from "./snapshot-builder.js";
export interface PlannerLifeEvidenceSlice {
    evidenceRefs: ControlPlaneSourceRef[];
    platformEventCount: number;
    workEventCount: number;
    emptyReason?: "no_sources" | "state_unavailable" | "redacted_only";
}
export declare function isLifeEvidenceSliceEmpty(slice: PlannerLifeEvidenceSlice): boolean;
export interface HardGuardDeps {
    hasDuplicateIntent: (idempotencyKey: string) => boolean;
    isOutreachCooldownClear: (idempotencyKey: string) => boolean;
}
export interface HeartbeatRuntimeSnapshot {
    continuity: ContinuitySnapshot;
    lifeEvidence: PlannerLifeEvidenceSlice;
    rhythmWindow: PlannerRhythmWindowSlice;
    hardGuards: HardGuardDeps;
    narrativeState?: import("../../../storage/narrative/narrative-state-store.js").NarrativeState;
    relationshipMemory?: import("../../../storage/relationship/relationship-memory-store.js").RelationshipMemory;
}
export declare function buildLifeEvidenceSliceFromInputs(inputs: SnapshotInputs): PlannerLifeEvidenceSlice;
export declare function buildHardGuardDeps(continuity: ContinuitySnapshot, inputs: SnapshotInputs): HardGuardDeps;
export declare function resolveRhythmPolicyForHeartbeat(inputs: SnapshotInputs): RhythmPolicy;
export declare function buildHeartbeatRuntimeSnapshot(timestamp: string, inputs: SnapshotInputs, continuity: ContinuitySnapshot): HeartbeatRuntimeSnapshot;
