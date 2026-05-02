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
export interface SnapshotInputs {
    mode: TopLevelMode;
    currentWindowId: string;
    pendingObligations: string[];
    recentOutreachHashes: string[];
    deniedIntents: Array<{
        intentHash: string;
        reason: string;
        at: string;
    }>;
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
}
/**
 * Build a ContinuitySnapshot from loaded inputs.
 *
 * In production, inputs come from state-system (mode, budgets, obligations),
 * workspace (outreach hashes, denied intents), and runtime context (window ID).
 */
export declare function buildContinuitySnapshot(inputs: SnapshotInputs): ContinuitySnapshot;
