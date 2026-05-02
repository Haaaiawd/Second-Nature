/**
 * Heartbeat Signal Contract
 *
 * Defines the signal types that enter the control-plane from various sources.
 * Per ADR-005: runtime scope classification depends on bridge protocol,
 * entry type, or explicit signal metadata, NOT on host natural classification.
 */

export type RuntimeScope = "rhythm" | "user_task" | "user_reply";

export type RuntimeTrigger = "heartbeat_bridge" | "user_task" | "user_reply" | "interrupt" | "resume";

export type HeartbeatCycleStatus =
  | "heartbeat_ok"
  | "intent_selected"
  | "deferred"
  | "denied"
  /** Host-safe packaged carrier: no lived-experience loop (ADR-005 / control-plane L0). */
  | "runtime_carrier_only";

export interface HeartbeatSignal {
  trigger: RuntimeTrigger;
  scopeHint?: RuntimeScope;
  payload: {
    timestamp: string;
    sessionContext?: string;
    heartbeatChecklist?: string;
  };
}

export interface ScopedRuntimeInput {
  trigger: RuntimeTrigger;
  scopeHint?: RuntimeScope;
  payload: Record<string, unknown>;
}

export interface HeartbeatCycleResult {
  scope: RuntimeScope;
  status: HeartbeatCycleStatus;
  selectedIntentId?: string;
  reasons: string[];
}

export interface ScopeRouteResult {
  scope: RuntimeScope;
  trigger: RuntimeTrigger;
  handled: boolean;
}
