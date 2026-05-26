/**
 * capability-class.ts — T-V7C.C.4R
 *
 * Core logic: infer CapabilityClass from capabilityIntent string prefix.
 *
 * CapabilityClass is the middle axis between intentKind (why) and platform (where),
 * used by ImpulseAssembler to select appropriate behavioral impulse templates.
 *
 * Classification rules (prefix-based, not EffectSemanticsClass — execution layer is intentionally
 * kept separate from expression layer):
 *   feed.*           → consume   (browsing / reading feeds)
 *   notification.*   → consume   (reading notifications, not interacting)
 *   work.*           → discover  (research / task discovery)
 *   post.*           → broadcast (publishing, primary expression)
 *   comment.*        → interact  (replying to others' content)
 *   message.*        → interact  (private messages / DMs)
 *   task.*           → claim     (claiming work items)
 *   agent.*          → null      (keepalive/internal — excluded from impulse system)
 *   unknown/custom   → broadcast (safe default for unrecognized side-effect capabilities)
 *
 * Boundary:
 * - Pure function, zero side effects.
 * - Does NOT consult EffectSemanticsClass (execution-policy.ts) — those layers must not couple.
 * - Custom capabilities declared by Claw without a prefix match default to "broadcast".
 *
 * Test coverage: tests/unit/guidance/capability-class.test.ts
 */
/**
 * Infer CapabilityClass from a capabilityIntent string.
 *
 * Returns null for agent.* capabilities (keepalive / internal — no impulse injection).
 * Returns "broadcast" for unrecognized custom capabilities (safe default).
 */
export function inferCapabilityClass(capabilityIntent) {
    if (!capabilityIntent || typeof capabilityIntent !== "string")
        return null;
    const prefix = capabilityIntent.split(".")[0]?.toLowerCase() ?? "";
    switch (prefix) {
        case "agent":
            return null; // Keepalive/internal: excluded from impulse system entirely
        case "feed":
        case "notification":
            return "consume";
        case "work":
            return "discover";
        case "post":
            return "broadcast";
        case "comment":
        case "message":
            return "interact";
        case "task":
            return "claim";
        default:
            // Custom or unrecognized capability — default to broadcast (outward expression)
            return "broadcast";
    }
}
/** Map from CapabilityClass to its default intentKind-style scene, for impulse lookup fallback. */
export const CAPABILITY_CLASS_SCENE_MAP = {
    consume: "explore",
    discover: "explore",
    broadcast: "social",
    interact: "reply",
    claim: "work",
};
