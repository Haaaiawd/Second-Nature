/**
 * impulse-assembler.ts — T-V7C.C.4R
 *
 * Core logic: three-level fallback impulse selection.
 *
 * Priority chain (highest → lowest):
 *   1. platform-specific impulse  — Claw-defined per platformId, loaded from workspace
 *   2. capabilityClass preset     — derived from capabilityIntent prefix via inferCapabilityClass
 *   3. intentKind fallback        — existing scene type impulse (social/outreach/reply/quiet)
 *   4. null                       — no impulse (baseline atmosphere still applies)
 *
 * Exclusions:
 *   - agent.* capabilities → null always (keepalive/internal, not an expression action)
 *   - explore/work capabilityClass impulses → approved and active (T-V7C.C.4R review complete)
 *
 * Boundary:
 * - Pure function composition; no I/O except the optional platformImpulsePort.
 * - Does NOT write state or emit events.
 * - SceneContext is enriched with capabilityIntent + platformId as optional fields
 *   to carry the dual-axis context without breaking existing SceneContext consumers.
 *
 * Test coverage: tests/unit/guidance/impulse-assembler.test.ts
 */
import type { ImpulseBlock, GuidanceSceneType } from "./types.js";
import { type CapabilityClass } from "./capability-class.js";
/** Extended scene context carrying dual-axis impulse selection inputs. */
export interface ImpulseSelectionContext {
    /** The intent kind (why) — maps to intentKind fallback impulse. */
    sceneType: GuidanceSceneType;
    /** The capability being executed (what physical form). e.g. "post.publish", "feed.read" */
    capabilityIntent?: string;
    /** The platform being targeted. Used for platform-specific impulse lookup. */
    platformId?: string;
}
/**
 * Port for loading platform-specific impulse overrides.
 * Claw implements this by writing impulse files to the workspace.
 * When absent, the assembler skips platform-specific lookup gracefully.
 */
export interface PlatformImpulsePort {
    /**
     * Load a platform-specific impulse for the given platformId + capabilityClass.
     * Returns null when no override is defined.
     */
    loadPlatformImpulse(input: {
        platformId: string;
        capabilityClass: CapabilityClass;
    }): Promise<ImpulseBlock | null>;
}
export interface ImpulseAssemblerResult {
    /** The selected impulse, or null if no applicable impulse exists. */
    impulse: ImpulseBlock | null;
    /** Which level of the fallback chain was used. */
    source: "platform_specific" | "capability_class" | "intent_kind" | "none";
    /** The inferred capability class (null for agent.* or unknown intent). */
    capabilityClass: CapabilityClass | null;
}
/**
 * Select the most specific impulse for a given scene + capability context.
 *
 * Fallback chain:
 *   platform-specific → capabilityClass preset → intentKind → null
 */
export declare function assembleImpulse(ctx: ImpulseSelectionContext, deps: {
    platformImpulsePort?: PlatformImpulsePort;
}): Promise<ImpulseAssemblerResult>;
/**
 * Synchronous variant for contexts where capabilityClass + intentKind are sufficient
 * and no platform-specific port is needed (e.g. guidance_payload ops command preview).
 */
export declare function assembleImpulseSync(ctx: ImpulseSelectionContext): ImpulseAssemblerResult;
