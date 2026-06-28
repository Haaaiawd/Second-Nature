/**
 * v9 ToolRoutine guard + sandbox validation (T6.2.2).
 *
 * Core logic:
 * - `validateGuardSchema` = `parseToolRoutineGuardSchema` (syntax, T4.2.1) +
 *   permission-expansion check (semantics, §6.3 validation rules).
 * - `validateSandboxCompliance` checks `stepsJson` against guard sandbox policy:
 *   `declarative_only` rejects scriptable steps; `strict` enforces
 *   `maxStepCount` and per-step `maxTimeoutMs` ceilings.
 * - `parseRoutineSteps` parses `stepsJson` into typed `RoutineStep[]`.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §6.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.5`
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (guard schema parser + routine types)
 *
 * Boundary:
 * - Pure functions; no DB access, no side effects.
 * - Does NOT evaluate invocation-time policy context (owned by
 *   action-closure-policy-system's `evaluateV9ActionPolicy`).
 *
 * Test coverage: `tests/unit/body/v9-tool-routine-registry.test.ts`
 */

import {
  parseToolRoutineGuardSchema,
  type RoutineStep,
  type SourceRef,
  type ToolRoutineGuardSchema,
  type V9ReasonCode,
} from "../../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Side-effect class ranking (mirrors v9-autonomy-policy-evaluator)
// ───────────────────────────────────────────────────────────────

const SIDE_EFFECT_CLASS_RANK: Record<
  "none" | "owner_attention" | "external_write",
  number
> = {
  none: 0,
  owner_attention: 1,
  external_write: 2,
};

/**
 * Infer the side-effect class ceiling of a capability from its id.
 * Mirrors `v9-autonomy-policy-evaluator.inferCapabilitySideEffectClass`
 * so install-time guard validation stays consistent with invocation-time
 * policy evaluation. A capability metadata registry will replace this
 * heuristic in a later wave.
 */
export function inferCapabilitySideEffectClass(
  capabilityId: string,
): "none" | "owner_attention" | "external_write" {
  const lastSegment = capabilityId.split(":").pop() ?? "";
  const actionHint = lastSegment.split(".").pop() ?? "";
  const writeHints = new Set([
    "write",
    "claim",
    "publish",
    "reply",
    "send",
    "post",
    "create",
    "update",
    "delete",
    "submit",
  ]);
  const notifyHints = new Set(["notify", "alert", "remind", "prompt"]);
  if (writeHints.has(actionHint)) return "external_write";
  if (notifyHints.has(actionHint)) return "owner_attention";
  return "owner_attention";
}

function matchesCapabilityPattern(capabilityId: string, pattern: string): boolean {
  if (pattern === capabilityId) return true;
  const regex = new RegExp(
    "^" +
      pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") +
      "$",
  );
  return regex.test(capabilityId);
}

function isCapabilityInTriggerSet(
  capabilityId: string,
  triggerCapabilities: string[] | undefined,
  capabilityPattern: string | undefined,
): boolean {
  if (triggerCapabilities?.some((tc) => tc === capabilityId)) return true;
  if (capabilityPattern && matchesCapabilityPattern(capabilityId, capabilityPattern)) return true;
  return false;
}

function maxOfTriggerCapabilities(
  triggerCapabilities: string[] | undefined,
  capabilityPattern: string | undefined,
): "none" | "owner_attention" | "external_write" {
  const candidates: string[] = [];
  if (triggerCapabilities?.length) candidates.push(...triggerCapabilities);
  if (capabilityPattern) candidates.push(capabilityPattern);
  if (candidates.length === 0) return "none";
  let maxRank = 0;
  for (const cap of candidates) {
    const cls = inferCapabilitySideEffectClass(cap);
    maxRank = Math.max(maxRank, SIDE_EFFECT_CLASS_RANK[cls]);
  }
  if (maxRank >= 2) return "external_write";
  if (maxRank >= 1) return "owner_attention";
  return "none";
}

// ───────────────────────────────────────────────────────────────
// validateGuardSchema
// ───────────────────────────────────────────────────────────────

export interface GuardValidationOk {
  ok: true;
  guard: ToolRoutineGuardSchema;
}

export interface GuardValidationFail {
  ok: false;
  reason: V9ReasonCode;
  detail?: string;
}

export type GuardValidationResult = GuardValidationOk | GuardValidationFail;

/**
 * Validate a ToolRoutine guard schema at install time.
 *
 * Combines:
 * 1. Syntax/structural validation (delegated to `parseToolRoutineGuardSchema`).
 * 2. Permission-expansion check (§6.3): `allowedCapabilities` must not exceed
 *    the routine's `triggerCapabilities` / `capabilityPattern` provenance, and
 *    `maxSideEffectClass` must not exceed the highest side-effect class of the
 *    trigger capability set.
 *
 * Returns a typed result; never throws.
 */
export function validateGuardSchema(
  guardSchemaJson: string | Record<string, unknown> | ToolRoutineGuardSchema | undefined,
  context: {
    triggerCapabilities?: string[];
    capabilityPattern?: string;
  },
): GuardValidationResult {
  const parsed = parseToolRoutineGuardSchema(guardSchemaJson);
  if (!parsed.ok) {
    return { ok: false, reason: "routine_guard_schema_invalid", detail: parsed.reason };
  }
  const guard = parsed.guard;

  // Permission expansion: allowedCapabilities must be a subset of the
  // routine's trigger provenance (triggerCapabilities ∪ capabilityPattern matches).
  const { triggerCapabilities, capabilityPattern } = context;
  const expandsCapability = guard.allowedCapabilities.some(
    (cap) => !isCapabilityInTriggerSet(cap, triggerCapabilities, capabilityPattern),
  );
  if (expandsCapability) {
    return { ok: false, reason: "routine_permission_expansion_denied" };
  }

  // Side-effect class ceiling: guard may not claim a higher side-effect class
  // than the routine's trigger capability provenance.
  const triggerMaxClass = maxOfTriggerCapabilities(triggerCapabilities, capabilityPattern);
  if (SIDE_EFFECT_CLASS_RANK[guard.maxSideEffectClass] > SIDE_EFFECT_CLASS_RANK[triggerMaxClass]) {
    return { ok: false, reason: "routine_permission_expansion_denied" };
  }

  return { ok: true, guard };
}

// ───────────────────────────────────────────────────────────────
// parseRoutineSteps + validateSandboxCompliance
// ───────────────────────────────────────────────────────────────

export interface StepsParseOk {
  ok: true;
  steps: RoutineStep[];
}

export interface StepsParseFail {
  ok: false;
  reason: string;
}

export type StepsParseResult = StepsParseOk | StepsParseFail;

/**
 * Parse `stepsJson` into typed `RoutineStep[]`.
 * Rejects malformed JSON or steps missing required fields.
 */
export function parseRoutineSteps(stepsJson: string | undefined): StepsParseResult {
  if (!stepsJson) {
    return { ok: false, reason: "missing_steps_json" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(stepsJson);
  } catch {
    return { ok: false, reason: "invalid_steps_json" };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "steps_not_array" };
  }
  const steps: RoutineStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object") {
      return { ok: false, reason: `step_${i}_not_object` };
    }
    if (typeof item.stepId !== "string" || !item.stepId) {
      return { ok: false, reason: `step_${i}_missing_stepId` };
    }
    if (item.kind !== "declarative" && item.kind !== "scriptable") {
      return { ok: false, reason: `step_${i}_invalid_kind` };
    }
    if (typeof item.capabilityId !== "string" || !item.capabilityId) {
      return { ok: false, reason: `step_${i}_missing_capabilityId` };
    }
    if (typeof item.summary !== "string") {
      return { ok: false, reason: `step_${i}_missing_summary` };
    }
    if (typeof item.timeoutMs !== "number" || item.timeoutMs < 0) {
      return { ok: false, reason: `step_${i}_invalid_timeoutMs` };
    }
    steps.push({
      stepId: item.stepId,
      kind: item.kind,
      capabilityId: item.capabilityId,
      summary: item.summary,
      timeoutMs: item.timeoutMs,
    });
  }
  return { ok: true, steps };
}

export interface SandboxValidationOk {
  ok: true;
}

export interface SandboxValidationFail {
  ok: false;
  reason: string;
  detail?: string;
}

export type SandboxValidationResult = SandboxValidationOk | SandboxValidationFail;

/**
 * Validate `stepsJson` against guard sandbox policy.
 *
 * Rules (§6.3 + §3.5):
 * - `sandboxPolicy=declarative_only` rejects any `scriptable` step at install time.
 * - Step count must not exceed `guard.maxStepCount`.
 * - Each step's `timeoutMs` must not exceed `guard.maxTimeoutMs`.
 * - Each step's `capabilityId` must be in `guard.allowedCapabilities` (when non-empty)
 *   and must not be in `guard.deniedCapabilities`.
 */
export function validateSandboxCompliance(
  stepsJson: string | undefined,
  guard: ToolRoutineGuardSchema,
): SandboxValidationResult {
  const parsed = parseRoutineSteps(stepsJson);
  if (!parsed.ok) {
    return { ok: false, reason: "routine_guard_sandbox_failed", detail: parsed.reason };
  }
  const steps = parsed.steps;

  // Step count ceiling.
  if (steps.length > guard.maxStepCount) {
    return {
      ok: false,
      reason: "routine_guard_sandbox_failed",
      detail: `step_count_${steps.length}_exceeds_max_${guard.maxStepCount}`,
    };
  }

  for (const step of steps) {
    // declarative_only rejects scriptable steps.
    if (guard.sandboxPolicy === "declarative_only" && step.kind === "scriptable") {
      return {
        ok: false,
        reason: "routine_guard_sandbox_failed",
        detail: `scriptable_step_${step.stepId}_rejected_by_declarative_only`,
      };
    }
    // Per-step timeout ceiling.
    if (step.timeoutMs > guard.maxTimeoutMs) {
      return {
        ok: false,
        reason: "routine_guard_sandbox_failed",
        detail: `step_${step.stepId}_timeout_${step.timeoutMs}_exceeds_max_${guard.maxTimeoutMs}`,
      };
    }
    // allowedCapabilities gate (when non-empty).
    if (
      guard.allowedCapabilities.length > 0 &&
      !guard.allowedCapabilities.includes(step.capabilityId)
    ) {
      return {
        ok: false,
        reason: "routine_guard_sandbox_failed",
        detail: `step_${step.stepId}_capability_${step.capabilityId}_not_allowed`,
      };
    }
    // deniedCapabilities block.
    if (guard.deniedCapabilities.includes(step.capabilityId)) {
      return {
        ok: false,
        reason: "routine_guard_sandbox_failed",
        detail: `step_${step.stepId}_capability_${step.capabilityId}_denied`,
      };
    }
  }

  return { ok: true };
}

// ───────────────────────────────────────────────────────────────
// Helpers for source ref construction
// ───────────────────────────────────────────────────────────────

export function routineSourceRef(routineId: string, label?: string): SourceRef {
  return { family: "routine", id: routineId, label };
}

export function ledgerSourceRef(ledgerId: string): SourceRef {
  return { family: "ledger", id: ledgerId };
}
