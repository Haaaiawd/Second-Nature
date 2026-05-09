const FORBIDDEN_SNAPSHOT_KEYS = ["allowedIntentKinds", "windowDecision", "rhythmWindow"];
/**
 * Reject drifted snapshot shapes that smuggle control-plane decision fields.
 */
export function assertRhythmPolicySnapshotContract(snapshot) {
    for (const key of FORBIDDEN_SNAPSHOT_KEYS) {
        if (key in snapshot) {
            throw new Error(`rhythm_policy_snapshot_field_drift:${key}`);
        }
    }
}
/**
 * Deterministic default windows from policy knobs (quiet hour tail when quietEnabled).
 */
export function rhythmPolicySnapshotToRhythmPolicy(snapshot) {
    assertRhythmPolicySnapshotContract(snapshot);
    if (snapshot.quietEnabled) {
        return {
            timezone: "UTC",
            quietSuppressionEnabled: true,
            windows: [
                { id: "w-work", startMinute: 0, endMinute: 480, mode: "active" },
                { id: "w-social", startMinute: 480, endMinute: 960, mode: "active" },
                { id: "w-reflection", startMinute: 960, endMinute: 1200, mode: "active" },
                { id: "w-quiet", startMinute: 1200, endMinute: 1440, mode: "quiet" },
            ],
        };
    }
    return {
        timezone: "UTC",
        quietSuppressionEnabled: false,
        windows: [{ id: "w-open", startMinute: 0, endMinute: 1440, mode: "active" }],
    };
}
