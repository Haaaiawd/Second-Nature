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

let state: LifecycleState = {
  registerCount: 0,
  phase: "idle",
  lastChangedAt: Date.now(),
};

/**
 * Record a plugin registration event and return updated lifecycle state.
 */
export function recordRegistration(): LifecycleState {
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
export function getLifecycleState(): LifecycleState {
  return { ...state };
}

/**
 * Reset lifecycle state (for testing or clean reload).
 */
export function resetLifecycle(): void {
  state = {
    registerCount: 0,
    phase: "idle",
    lastChangedAt: Date.now(),
  };
}
