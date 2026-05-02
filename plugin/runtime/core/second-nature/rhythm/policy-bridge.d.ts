/**
 * Bridges state-system RhythmPolicySnapshot fields into control-plane RhythmPolicy (T2.1.2).
 *
 * State never emits window decisions or allowedIntentKinds; control-plane owns
 * window geometry used by selectRhythmWindow(). Callers pass a pick of the DB read model.
 */
import type { RhythmPolicy } from "./rhythm-policy.js";
/** Subset of `RhythmPolicySnapshot` used for window derivation (no storage import from core). */
export interface RhythmPolicySnapshotBridgeInput {
    quietEnabled: boolean;
}
/**
 * Reject drifted snapshot shapes that smuggle control-plane decision fields.
 */
export declare function assertRhythmPolicySnapshotContract(snapshot: Record<string, unknown>): void;
/**
 * Deterministic default windows from policy knobs (quiet hour tail when quietEnabled).
 */
export declare function rhythmPolicySnapshotToRhythmPolicy(snapshot: RhythmPolicySnapshotBridgeInput): RhythmPolicy;
