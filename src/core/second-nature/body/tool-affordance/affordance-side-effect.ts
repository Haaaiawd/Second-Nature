/**
 * AffordanceSideEffect — v8 capability side-effect classifier.
 *
 * Core logic: Derive effective side-effect class for `run_connector` actions
 * from connector capability metadata. Action policy uses this to decide
 * allow/defer/downgrade/deny without knowing platform internals.
 *
 * Classification rules:
 * - `feed.read`, `work.discover`, `notification.list` → external_read
 * - `post.publish`, `comment.reply`, `message.send`, `task.claim` → external_write
 * - `agent.register`, `agent.heartbeat` → local_state
 * - Unknown / unlisted capability → unknown (policy must deny or downgrade)
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/body-tool-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §1.2`
 *
 * Dependencies:
 * - `ConnectorCapabilitySideEffect` from `../../../../shared/types/v8-contracts.js`
 *
 * Boundary:
 * - Pure classification function; no side effects, no DB access.
 * - Does NOT perform capability probe — reads manifest metadata only.
 * - Unknown capabilities return `unknown`; caller (policy) decides posture.
 *
 * Test coverage: tests/unit/body/affordance-side-effect.test.ts
 */

import type {
  ConnectorCapabilitySideEffect,
} from "../../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Capability → side-effect mapping
// ───────────────────────────────────────────────────────────────

const READ_CAPABILITIES = new Set<string>([
  "feed.read",
  "work.discover",
  "notification.list",
  "profile.inspect",
  "github:issue.search",
]);

const WRITE_CAPABILITIES = new Set<string>([
  "post.publish",
  "comment.reply",
  "message.send",
  "task.claim",
]);

const LOCAL_STATE_CAPABILITIES = new Set<string>([
  "agent.register",
  "agent.heartbeat",
  "status.update",
]);

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function deriveConnectorSideEffect(
  capabilityId: string,
): ConnectorCapabilitySideEffect {
  if (READ_CAPABILITIES.has(capabilityId)) return "external_read";
  if (WRITE_CAPABILITIES.has(capabilityId)) return "external_write";
  if (LOCAL_STATE_CAPABILITIES.has(capabilityId)) return "local_state";
  return "unknown";
}

export interface CapabilityAffordancePosture {
  connectorId: string;
  capabilityId: string;
  sideEffectClass: ConnectorCapabilitySideEffect;
  authStatus: "ready" | "needs_auth" | "revoked" | "unknown";
  breakerStatus: "closed" | "open" | "half_open";
}

export function assembleCapabilityAffordancePosture(
  connectorId: string,
  capabilityId: string,
  authStatus: CapabilityAffordancePosture["authStatus"],
  breakerStatus: CapabilityAffordancePosture["breakerStatus"],
): CapabilityAffordancePosture {
  return {
    connectorId,
    capabilityId,
    sideEffectClass: deriveConnectorSideEffect(capabilityId),
    authStatus,
    breakerStatus,
  };
}

export interface SideEffectAwareAffordanceMap {
  [connectorId: string]: {
    [capabilityId: string]: CapabilityAffordancePosture;
  };
}

export function buildSideEffectAwareAffordanceMap(
  postures: CapabilityAffordancePosture[],
): SideEffectAwareAffordanceMap {
  const map: SideEffectAwareAffordanceMap = {};
  for (const posture of postures) {
    if (!map[posture.connectorId]) {
      map[posture.connectorId] = {};
    }
    map[posture.connectorId][posture.capabilityId] = posture;
  }
  return map;
}

export function lookupSideEffectPosture(
  map: SideEffectAwareAffordanceMap,
  connectorId: string,
  capabilityId: string,
): CapabilityAffordancePosture | undefined {
  return map[connectorId]?.[capabilityId];
}

// ───────────────────────────────────────────────────────────────
// Policy-facing helpers
// ───────────────────────────────────────────────────────────────

export function isWriteSideEffect(
  sideEffect: ConnectorCapabilitySideEffect,
): boolean {
  return sideEffect === "external_write";
}

export function isReadSideEffect(
  sideEffect: ConnectorCapabilitySideEffect,
): boolean {
  return sideEffect === "external_read";
}

export function isLocalStateSideEffect(
  sideEffect: ConnectorCapabilitySideEffect,
): boolean {
  return sideEffect === "local_state";
}

export function isUnknownSideEffect(
  sideEffect: ConnectorCapabilitySideEffect,
): boolean {
  return sideEffect === "unknown";
}

export function effectiveActionSideEffectClass(
  sideEffect: ConnectorCapabilitySideEffect,
): "external_write" | "external_read" | "local_state" | "unknown" {
  return sideEffect;
}
