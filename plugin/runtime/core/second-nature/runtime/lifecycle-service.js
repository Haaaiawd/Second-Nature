/**
 * Second Nature Lifecycle Service Entry
 *
 * Provides lifecycle management for the plugin: load, reload, and unload events.
 * Tracks registration state and coordinates runtime service initialization.
 */
let state = {
    registerCount: 0,
    phase: "idle",
    lastChangedAt: Date.now(),
};
/**
 * Record a plugin registration event and return updated lifecycle state.
 */
export function recordRegistration() {
    state.registerCount += 1;
    state.phase = state.registerCount === 1 ? "loading" : "reloading";
    state.lastChangedAt = Date.now();
    // Transition to loaded after registration completes
    state.phase = "loaded";
    return { ...state };
}
/**
 * Get current lifecycle state snapshot.
 */
export function getLifecycleState() {
    return { ...state };
}
/**
 * Reset lifecycle state (for testing or clean reload).
 */
export function resetLifecycle() {
    state = {
        registerCount: 0,
        phase: "idle",
        lastChangedAt: Date.now(),
    };
}
