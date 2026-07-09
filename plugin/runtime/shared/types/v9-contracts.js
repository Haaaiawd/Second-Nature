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
export function parseToolRoutineGuardSchema(input) {
    if (!input) {
        return { ok: false, reason: "missing_guard_schema" };
    }
    let raw;
    if (typeof input === "string") {
        try {
            raw = JSON.parse(input);
        }
        catch {
            return { ok: false, reason: "invalid_json" };
        }
    }
    else if (typeof input === "object") {
        raw = input;
    }
    else {
        return { ok: false, reason: "invalid_input_type" };
    }
    if (raw.version !== "1.0.0") {
        return { ok: false, reason: "unsupported_version" };
    }
    if (!Array.isArray(raw.allowedCapabilities)) {
        return { ok: false, reason: "missing_allowed_capabilities" };
    }
    if (!Array.isArray(raw.deniedCapabilities)) {
        return { ok: false, reason: "missing_denied_capabilities" };
    }
    const maxSideEffectClass = raw.maxSideEffectClass;
    if (maxSideEffectClass !== "none" &&
        maxSideEffectClass !== "owner_attention" &&
        maxSideEffectClass !== "external_write") {
        return { ok: false, reason: "invalid_max_side_effect_class" };
    }
    if (typeof raw.requiresOwnerConfirm !== "boolean") {
        return { ok: false, reason: "missing_requires_owner_confirm" };
    }
    if (typeof raw.maxStepCount !== "number" || raw.maxStepCount < 0) {
        return { ok: false, reason: "invalid_max_step_count" };
    }
    if (typeof raw.maxTimeoutMs !== "number" || raw.maxTimeoutMs < 0) {
        return { ok: false, reason: "invalid_max_timeout_ms" };
    }
    const sandboxPolicy = raw.sandboxPolicy;
    if (sandboxPolicy !== "strict" && sandboxPolicy !== "declarative_only") {
        return { ok: false, reason: "invalid_sandbox_policy" };
    }
    return {
        ok: true,
        guard: {
            version: "1.0.0",
            allowedCapabilities: raw.allowedCapabilities.map(String),
            deniedCapabilities: raw.deniedCapabilities.map(String),
            maxSideEffectClass,
            requiresOwnerConfirm: raw.requiresOwnerConfirm,
            maxStepCount: raw.maxStepCount,
            maxTimeoutMs: raw.maxTimeoutMs,
            sandboxPolicy,
        },
    };
}
/** Pre-activation gates in §4.2 order. */
export const PRE_ACTIVATION_GATES = [
    "schema",
    "permission",
    "sandbox",
    "fixture",
    "wet_probe",
    "rollback_setup",
];
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
