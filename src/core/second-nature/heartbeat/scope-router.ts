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
import type { RuntimeScope, ScopedRuntimeInput, ScopeRouteResult } from "./signal.js";

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
export function routeScopedInput(input: ScopedRuntimeInput, _deps?: ScopeRouterDeps): ScopeRouteResult {
  // Priority 1: Use explicit scopeHint if provided
  if (input.scopeHint) {
    return {
      scope: input.scopeHint,
      trigger: input.trigger,
      handled: true,
    };
  }

  // Priority 2: Map trigger type to scope
  const scope = triggerToScope(input.trigger);
  return {
    scope,
    trigger: input.trigger,
    handled: true,
  };
}

/**
 * Map a trigger type to its default runtime scope.
 *
 * This is the fallback when no explicit scopeHint is provided.
 */
function triggerToScope(trigger: ScopedRuntimeInput["trigger"]): RuntimeScope {
  switch (trigger) {
    case "heartbeat_bridge":
      return "rhythm";
    case "user_task":
      return "user_task";
    case "user_reply":
      return "user_reply";
    case "interrupt":
      return "rhythm";
    case "resume":
      return "rhythm";
    default:
      return "rhythm";
  }
}
