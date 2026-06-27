/**
 * v9 Shared Contracts — Cross-system value contracts for Self Continuity, Character & Procedural Evolution.
 *
 * Core logic: Single source of truth for types that would otherwise be
 * duplicated across attention, control-context, action-closure-policy,
 * memory-continuity, body-connector, character-continuity, and
 * observability-recovery systems.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §2.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §2.1, §3.2`
 *
 * Dependencies: none (primitive shared types).
 * Boundary: Type definitions only; no runtime logic.
 * Test coverage: `tests/unit/contracts/v9-shared-contracts.test.ts`
 */
export const V9_ACTION_KIND_REGISTRY = {
    ignore: {
        kind: "ignore",
        sideEffectClass: "none",
        allowedDowngrades: [],
    },
    watch: {
        kind: "watch",
        sideEffectClass: "local_state",
        allowedDowngrades: [],
    },
    remember: {
        kind: "remember",
        sideEffectClass: "local_state",
        allowedDowngrades: ["watch"],
    },
    notify_owner: {
        kind: "notify_owner",
        sideEffectClass: "owner_attention",
        allowedDowngrades: ["watch"],
    },
    draft_reply: {
        kind: "draft_reply",
        sideEffectClass: "local_state",
        allowedDowngrades: ["notify_owner", "watch"],
    },
    auto_reply: {
        kind: "auto_reply",
        sideEffectClass: "external_write",
        allowedDowngrades: ["draft_reply", "notify_owner", "watch"],
    },
    draft_publish: {
        kind: "draft_publish",
        sideEffectClass: "local_state",
        allowedDowngrades: ["notify_owner", "watch"],
    },
    auto_publish: {
        kind: "auto_publish",
        sideEffectClass: "external_write",
        allowedDowngrades: ["draft_publish", "notify_owner", "watch"],
    },
    run_connector: {
        kind: "run_connector",
        sideEffectClass: "capability_declared",
        allowedDowngrades: ["notify_owner", "watch"],
    },
    routine: {
        kind: "routine",
        sideEffectClass: "routine",
        allowedDowngrades: ["notify_owner", "watch"],
    },
};
