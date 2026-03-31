/**
 * Second Nature Lifecycle Service Entry
 *
 * Provides lifecycle management for the plugin: load, reload, and unload events.
 * Tracks registration state and coordinates runtime service initialization.
 */
export interface LifecycleState {
    /** Number of times the plugin has been registered */
    registerCount: number;
    /** Current lifecycle phase */
    phase: "idle" | "loading" | "loaded" | "reloading" | "unloading";
    /** Timestamp of last state change */
    lastChangedAt: number;
}
/**
 * Record a plugin registration event and return updated lifecycle state.
 */
export declare function recordRegistration(): LifecycleState;
/**
 * Get current lifecycle state snapshot.
 */
export declare function getLifecycleState(): LifecycleState;
/**
 * Reset lifecycle state (for testing or clean reload).
 */
export declare function resetLifecycle(): void;
