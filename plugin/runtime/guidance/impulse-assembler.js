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
import { inferCapabilityClass, CAPABILITY_CLASS_SCENE_MAP, } from "./capability-class.js";
import { getImpulseTemplate, getCapabilityClassImpulseTemplate, } from "./template-registry.js";
// ─── Core assembly logic ──────────────────────────────────────────────────────
/**
 * Select the most specific impulse for a given scene + capability context.
 *
 * Fallback chain:
 *   platform-specific → capabilityClass preset → intentKind → null
 */
export async function assembleImpulse(ctx, deps) {
    // Infer capability class from capabilityIntent prefix
    const capabilityClass = ctx.capabilityIntent
        ? inferCapabilityClass(ctx.capabilityIntent)
        : null;
    // agent.* → excluded entirely
    if (ctx.capabilityIntent && inferCapabilityClass(ctx.capabilityIntent) === null &&
        ctx.capabilityIntent.startsWith("agent.")) {
        return { impulse: null, source: "none", capabilityClass: null };
    }
    // ── Level 1: platform-specific ──────────────────────────────────────────────
    if (ctx.platformId && capabilityClass && deps.platformImpulsePort) {
        try {
            const platformImpulse = await deps.platformImpulsePort.loadPlatformImpulse({
                platformId: ctx.platformId,
                capabilityClass,
            });
            if (platformImpulse) {
                return { impulse: platformImpulse, source: "platform_specific", capabilityClass };
            }
        }
        catch {
            // Port failure → fall through gracefully
        }
    }
    // ── Level 2: capabilityClass preset ─────────────────────────────────────────
    if (capabilityClass) {
        const ccImpulseKind = CAPABILITY_CLASS_SCENE_MAP[capabilityClass];
        const ccImpulse = getCapabilityClassImpulseTemplate(ccImpulseKind);
        if (ccImpulse) {
            return { impulse: ccImpulse, source: "capability_class", capabilityClass };
        }
        // explore/work are pending review → fall through to intentKind
    }
    // ── Level 3: intentKind fallback ─────────────────────────────────────────────
    const sceneType = ctx.sceneType;
    if (sceneType !== "explain" && sceneType !== "user_reply") {
        const intentImpulse = getImpulseTemplate(sceneType);
        return { impulse: intentImpulse, source: "intent_kind", capabilityClass };
    }
    // ── Level 4: no impulse ───────────────────────────────────────────────────────
    return { impulse: null, source: "none", capabilityClass };
}
/**
 * Synchronous variant for contexts where capabilityClass + intentKind are sufficient
 * and no platform-specific port is needed (e.g. guidance_payload ops command preview).
 */
export function assembleImpulseSync(ctx) {
    const capabilityClass = ctx.capabilityIntent
        ? inferCapabilityClass(ctx.capabilityIntent)
        : null;
    // agent.* excluded
    if (ctx.capabilityIntent?.startsWith("agent.")) {
        return { impulse: null, source: "none", capabilityClass: null };
    }
    // capabilityClass preset (sync — no platform port available)
    if (capabilityClass) {
        const ccImpulseKind = CAPABILITY_CLASS_SCENE_MAP[capabilityClass];
        const ccImpulse = getCapabilityClassImpulseTemplate(ccImpulseKind);
        if (ccImpulse) {
            return { impulse: ccImpulse, source: "capability_class", capabilityClass };
        }
    }
    // intentKind fallback
    const sceneType = ctx.sceneType;
    if (sceneType !== "explain" && sceneType !== "user_reply") {
        const intentImpulse = getImpulseTemplate(sceneType);
        return { impulse: intentImpulse, source: "intent_kind", capabilityClass };
    }
    return { impulse: null, source: "none", capabilityClass };
}
