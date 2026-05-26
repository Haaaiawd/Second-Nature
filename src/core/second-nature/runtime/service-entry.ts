/**
 * Second Nature Runtime Service Entry
 *
 * This module provides the actual implementation for the `second-nature-runtime` service.
 * It serves as the heartbeat host bridge candidate carrier and initializes the
 * minimal runtime state needed for the plugin to function.
 *
 * Per ADR-005: heartbeat is the free-rhythm main entry; this service provides
 * the stable runtime state that heartbeat rounds will interact with.
 */

export interface RuntimeServiceContext {
  /** Workspace root path for state/observability databases */
  workspaceRoot?: string;
  /** Plugin configuration overrides */
  config?: Record<string, unknown>;
}

export interface RuntimeServiceHandle {
  /** Service is ready and accepting requests */
  ready: boolean;
  /** Runtime version string */
  version: string;
  /** Close the runtime handle and release resources */
  close: () => void;
}

let activeHandle: RuntimeServiceHandle | null = null;

/**
 * Start the Second Nature runtime service.
 *
 * This is the non-empty implementation that replaces the previous `start() { return; }` shell.
 * It initializes the minimal runtime state and returns a handle that can be used
 * by the heartbeat host bridge.
 */
export function startRuntimeService(
  ctx?: RuntimeServiceContext,
): RuntimeServiceHandle {
  if (activeHandle?.ready) {
    return activeHandle;
  }

  // Initialize minimal runtime state
  // In future iterations, this will connect to:
  // - state-system (SQLite database initialization)
  // - observability-system (event store setup)
  // - control-plane-system (heartbeat bridge preparation)
  const workspaceRoot = ctx?.workspaceRoot ?? process.cwd();
  /** Keep in sync with `plugin/package.json` when cutting releases. */
  const version = "0.1.38";

  activeHandle = {
    ready: true,
    version,
    close() {
      activeHandle = null;
    },
  };

  return activeHandle;
}

/**
 * Get the current runtime service handle, or null if not started.
 */
export function getRuntimeHandle(): RuntimeServiceHandle | null {
  return activeHandle;
}
