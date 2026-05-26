/**
 * Snapshot Builder
 *
 * Builds a ContinuitySnapshot from state-system, workspace, and runtime context.
 * This is the input preparation step for each heartbeat round.
 *
 * Per design doc §4.2: SnapshotBuilder prepares inputs for the Rhythm Engine.
 */
import type { ContinuitySnapshot, ControlPlaneSourceRef, TopLevelMode } from "../types.js";
import type { RhythmPolicy } from "../rhythm/rhythm-policy.js";
import type { DeliveryCapabilitySnapshot } from "../outreach/delivery-target.js";
import type { UserInterestSnapshot } from "../../../storage/user-interest/types.js";
import type { NarrativeState } from "../../../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../../../storage/relationship/relationship-memory-store.js";
import type { AffordanceMap, IdentityProfile } from "../../../shared/types/v7-entities.js";

export interface SnapshotInputs {
  mode: TopLevelMode;
  currentWindowId: string;
  pendingObligations: string[];
  recentOutreachHashes: string[];
  deniedIntents: Array<{ intentHash: string; reason: string; at: string }>;
  budgets?: {
    socialUsed: number;
    socialLimit: number;
  };
  awaitingUserInput?: boolean;
  riskSuppressed?: boolean;
  /** Evidence refs for source-backed planner/guards (T2.1.3 / T2.2.1). */
  lifeEvidenceRefs?: ControlPlaneSourceRef[];
  platformEventCount?: number;
  workEventCount?: number;
  lifeEvidenceEmptyReason?: "no_sources" | "state_unavailable" | "redacted_only";
  /** Optional explicit rhythm geometry; otherwise `quietEnabledBridge` drives policy-bridge default. */
  rhythmPolicy?: RhythmPolicy;
  /** Passed to `rhythmPolicySnapshotToRhythmPolicy` when `rhythmPolicy` is absent. */
  quietEnabledBridge?: boolean;
  duplicateIntentKeys?: string[];
  outreachCooldownKeys?: string[];
  /** When present, outreach judgment uses this delivery snapshot (ADR-007). */
  deliveryCapability?: DeliveryCapabilitySnapshot;
  /** When present, outreach judgment uses this user-interest read model (T4.2.2). */
  userInterestSnapshot?: UserInterestSnapshot;
  /** T2.1.4: accepted goals to influence candidate intent priority. */
  acceptedGoals?: Array<{
    goalId: string;
    description: string;
    completionCriteria?: string;
    status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
    origin: "owner_set" | "agent_proposed" | "policy_seeded";
    acceptedBy?: "owner" | "policy_allowlist";
  }>;
  /** When present, signals that acceptedGoals load failed (distinguishes from empty). */
  acceptedGoalsLoadError?: string;
  /** When present, planner uses narrative focus to influence candidate priority. */
  narrativeState?: NarrativeState;
  /** When present, planner uses relationship memory to influence outreach timing. */
  relationshipMemory?: RelationshipMemory;
  /** v7: affordance map for breaker-aware guard evaluation (T-V7C.C.2). */
  affordanceMap?: AffordanceMap;
  /** T-V7C.C.4: identity profile for connector request identity injection. */
  identity?: IdentityProfile;
}

/**
 * Build a ContinuitySnapshot from loaded inputs.
 *
 * In production, inputs come from state-system (mode, budgets, obligations),
 * workspace (outreach hashes, denied intents), and runtime context (window ID).
 */
export function buildContinuitySnapshot(inputs: SnapshotInputs): ContinuitySnapshot {
  return {
    mode: inputs.mode,
    currentWindowId: inputs.currentWindowId,
    pendingObligations: inputs.pendingObligations,
    recentOutreachHashes: inputs.recentOutreachHashes,
    deniedIntents: inputs.deniedIntents,
    budgets: inputs.budgets,
    awaitingUserInput: inputs.awaitingUserInput,
    riskSuppressed: inputs.riskSuppressed,
  };
}
