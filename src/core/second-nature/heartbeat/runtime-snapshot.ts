/**
 * HeartbeatRuntimeSnapshot assembly for candidate planner + hard guards (T2.1.3, T2.2.1).
 */
import type { ContinuitySnapshot } from "../types.js";
import type { SourceRef } from "../../../shared/types/v8-contracts.js";
import type { RhythmPolicy } from "../rhythm/rhythm-policy.js";
import { rhythmPolicySnapshotToRhythmPolicy } from "../rhythm/policy-bridge.js";
import { buildPlannerRhythmWindow, type PlannerRhythmWindowSlice } from "../rhythm/planner-rhythm-window.js";
import type { SnapshotInputs } from "./snapshot-builder.js";
import type { AffordanceMap } from "../../../shared/types/v7-entities.js";

export interface PlannerLifeEvidenceSlice {
  evidenceRefs: SourceRef[];
  platformEventCount: number;
  workEventCount: number;
  emptyReason?: "no_sources" | "state_unavailable" | "redacted_only";
}

export function isLifeEvidenceSliceEmpty(slice: PlannerLifeEvidenceSlice): boolean {
  return slice.evidenceRefs.length === 0 && slice.platformEventCount === 0 && slice.workEventCount === 0;
}

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
  /** v7: affordance map for breaker-aware guard evaluation (T-V7C.C.2). */
  affordanceMap?: AffordanceMap;
  /** T-V7C.C.4: identity profile for connector request identity injection. */
  identity?: import("../../../shared/types/v7-entities.js").IdentityProfile;
}

export function buildLifeEvidenceSliceFromInputs(inputs: SnapshotInputs): PlannerLifeEvidenceSlice {
  return {
    evidenceRefs: inputs.lifeEvidenceRefs ?? [],
    platformEventCount: inputs.platformEventCount ?? 0,
    workEventCount: inputs.workEventCount ?? 0,
    emptyReason: inputs.lifeEvidenceEmptyReason,
  };
}

export function buildHardGuardDeps(continuity: ContinuitySnapshot, inputs: SnapshotInputs): HardGuardDeps {
  return {
    hasDuplicateIntent: (key: string) =>
      (inputs.duplicateIntentKeys?.includes(key) ?? false) ||
      continuity.deniedIntents.some((d) => d.reason === "duplicate_intent" && d.intentHash === key),
    isOutreachCooldownClear: (key: string) => !(inputs.outreachCooldownKeys?.includes(key) ?? false),
  };
}

export function resolveRhythmPolicyForHeartbeat(inputs: SnapshotInputs): RhythmPolicy {
  if (inputs.rhythmPolicy) {
    return inputs.rhythmPolicy;
  }
  return rhythmPolicySnapshotToRhythmPolicy({
    quietEnabled: inputs.quietEnabledBridge ?? false,
  });
}

export function buildHeartbeatRuntimeSnapshot(
  timestamp: string,
  inputs: SnapshotInputs,
  continuity: ContinuitySnapshot,
): HeartbeatRuntimeSnapshot {
  const policy = resolveRhythmPolicyForHeartbeat(inputs);
  const rhythmWindow = buildPlannerRhythmWindow(timestamp, continuity, policy);
  const lifeEvidence = buildLifeEvidenceSliceFromInputs(inputs);
  const hardGuards = buildHardGuardDeps(continuity, inputs);
  return {
    continuity,
    lifeEvidence,
    rhythmWindow,
    hardGuards,
    narrativeState: inputs.narrativeState,
    relationshipMemory: inputs.relationshipMemory,
    affordanceMap: inputs.affordanceMap,
    identity: inputs.identity,
  };
}
