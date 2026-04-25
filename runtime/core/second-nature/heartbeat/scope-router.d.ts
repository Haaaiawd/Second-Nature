/**
 * Scope Signal Router
 *
 * Routes incoming signals to the correct runtime scope based on
 * bridge protocol, entry type, or explicit signal metadata.
 *
 * Per ADR-005: runtime scope classification must NOT assume host natural
 * classification. It depends on explicit signal metadata.
 *
 * Three scopes:
 * - rhythm: heartbeat bridge signals, enters free-rhythm decision chain
 * - user_task: user explicit tasks, bypasses rhythm gate entirely
 * - user_reply: direct user replies, only gets very light continuity
 */
import type { ScopedRuntimeInput, ScopeRouteResult } from "./signal.js";
export interface ScopeRouterDeps {
    /** Optional: additional context for scope resolution */
    getContext: () => Record<string, unknown>;
}
/**
 * Route a scoped input to the correct runtime chain.
 *
 * Classification priority:
 * 1. Explicit scopeHint from the signal
 * 2. Trigger type mapping
 * 3. Default fallback to rhythm for unknown triggers
 */
export declare function routeScopedInput(input: ScopedRuntimeInput, _deps?: ScopeRouterDeps): ScopeRouteResult;
