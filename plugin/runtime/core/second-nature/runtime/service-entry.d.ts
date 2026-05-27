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
    /** Runtime version — supplied by the plugin entry from its package manifest */
    version?: string;
}
export interface RuntimeServiceHandle {
    /** Service is ready and accepting requests */
    ready: boolean;
    /** Runtime version string */
    version: string;
    /** Close the runtime handle and release resources */
    close: () => void;
}
/**
 * Start the Second Nature runtime service.
 *
 * This is the non-empty implementation that replaces the previous `start() { return; }` shell.
 * It initializes the minimal runtime state and returns a handle that can be used
 * by the heartbeat host bridge.
 */
export declare function startRuntimeService(ctx?: RuntimeServiceContext): RuntimeServiceHandle;
/**
 * Get the current runtime service handle, or null if not started.
 */
export declare function getRuntimeHandle(): RuntimeServiceHandle | null;
