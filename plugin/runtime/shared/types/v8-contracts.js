/**
 * v8 Shared Contracts — Cross-system value contracts for Living Perception Loop.
 *
 * Core logic: Single source of truth for types that would otherwise be
 * duplicated across perception-judgment, action-closure-policy,
 * dream-quiet-memory, observability-health, and control-plane systems.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §1`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §2`
 *
 * Dependencies: none (primitive shared types).
 * Boundary: Type definitions only; no runtime logic.
 * Test coverage: tests/unit/contracts/v8-shared-contracts.test.ts
 */
// ───────────────────────────────────────────────────────────────
// 7. Action Kind Registry Metadata Table
// ───────────────────────────────────────────────────────────────
export const ACTION_KIND_REGISTRY = {
    ignore: {
        kind: "ignore",
        sideEffectClass: "none",
        attentionClass: "none",
        requiresPolicyDecision: false,
        allowedDowngrades: [],
    },
    watch: {
        kind: "watch",
        sideEffectClass: "local_state",
        attentionClass: "none",
        requiresPolicyDecision: false,
        allowedDowngrades: [],
    },
    remember: {
        kind: "remember",
        sideEffectClass: "local_state",
        attentionClass: "none",
        requiresPolicyDecision: true,
        allowedDowngrades: ["watch"],
    },
    notify_owner: {
        kind: "notify_owner",
        sideEffectClass: "owner_attention",
        attentionClass: "owner_visible",
        requiresPolicyDecision: true,
        allowedDowngrades: ["watch"],
    },
    draft_reply: {
        kind: "draft_reply",
        sideEffectClass: "local_state",
        attentionClass: "owner_visible",
        requiresPolicyDecision: true,
        allowedDowngrades: ["notify_owner", "watch"],
    },
    auto_reply: {
        kind: "auto_reply",
        sideEffectClass: "external_write",
        attentionClass: "external_visible",
        requiresPolicyDecision: true,
        allowedDowngrades: ["draft_reply", "notify_owner", "watch"],
    },
    draft_publish: {
        kind: "draft_publish",
        sideEffectClass: "local_state",
        attentionClass: "owner_visible",
        requiresPolicyDecision: true,
        allowedDowngrades: ["notify_owner", "watch"],
    },
    auto_publish: {
        kind: "auto_publish",
        sideEffectClass: "external_write",
        attentionClass: "external_visible",
        requiresPolicyDecision: true,
        allowedDowngrades: ["draft_publish", "notify_owner", "watch"],
    },
    run_connector: {
        kind: "run_connector",
        sideEffectClass: "capability_declared",
        attentionClass: "depends_on_capability",
        requiresPolicyDecision: true,
        allowedDowngrades: ["notify_owner", "watch"],
    },
};
