/**
 * HeartbeatRuntimeSnapshot assembly for candidate planner + hard guards (T2.1.3, T2.2.1).
 */
import type { ContinuitySnapshot, ControlPlaneSourceRef } from "../types.js";
import type { RhythmPolicy } from "../rhythm/rhythm-policy.js";
import { rhythmPolicySnapshotToRhythmPolicy } from "../rhythm/policy-bridge.js";
import { buildPlannerRhythmWindow, type PlannerRhythmWindowSlice } from "../rhythm/planner-rhythm-window.js";
import type { SnapshotInputs } from "./snapshot-builder.js";

export interface PlannerLifeEvidenceSlice {
  evidenceRefs: ControlPlaneSourceRef[];
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
  return { continuity, lifeEvidence, rhythmWindow, hardGuards, narrativeState: inputs.narrativeState, relationshipMemory: inputs.relationshipMemory };
}
