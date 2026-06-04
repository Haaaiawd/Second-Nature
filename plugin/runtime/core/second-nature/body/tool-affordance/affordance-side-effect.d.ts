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
import type { ConnectorCapabilitySideEffect } from "../../../../shared/types/v8-contracts.js";
export declare function deriveConnectorSideEffect(capabilityId: string): ConnectorCapabilitySideEffect;
export interface CapabilityAffordancePosture {
    connectorId: string;
    capabilityId: string;
    sideEffectClass: ConnectorCapabilitySideEffect;
    authStatus: "ready" | "needs_auth" | "revoked" | "unknown";
    breakerStatus: "closed" | "open" | "half_open";
}
export declare function assembleCapabilityAffordancePosture(connectorId: string, capabilityId: string, authStatus: CapabilityAffordancePosture["authStatus"], breakerStatus: CapabilityAffordancePosture["breakerStatus"]): CapabilityAffordancePosture;
export interface SideEffectAwareAffordanceMap {
    [connectorId: string]: {
        [capabilityId: string]: CapabilityAffordancePosture;
    };
}
export declare function buildSideEffectAwareAffordanceMap(postures: CapabilityAffordancePosture[]): SideEffectAwareAffordanceMap;
export declare function lookupSideEffectPosture(map: SideEffectAwareAffordanceMap, connectorId: string, capabilityId: string): CapabilityAffordancePosture | undefined;
export declare function isWriteSideEffect(sideEffect: ConnectorCapabilitySideEffect): boolean;
export declare function isReadSideEffect(sideEffect: ConnectorCapabilitySideEffect): boolean;
export declare function isLocalStateSideEffect(sideEffect: ConnectorCapabilitySideEffect): boolean;
export declare function isUnknownSideEffect(sideEffect: ConnectorCapabilitySideEffect): boolean;
export declare function effectiveActionSideEffectClass(sideEffect: ConnectorCapabilitySideEffect): "external_write" | "external_read" | "local_state" | "unknown";
