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
import { type RoutineStep, type SourceRef, type ToolRoutineGuardSchema, type V9ReasonCode } from "../../../../shared/types/v9-contracts.js";
/**
 * Infer the side-effect class ceiling of a capability from its id.
 * Mirrors `v9-autonomy-policy-evaluator.inferCapabilitySideEffectClass`
 * so install-time guard validation stays consistent with invocation-time
 * policy evaluation. A capability metadata registry will replace this
 * heuristic in a later wave.
 */
export declare function inferCapabilitySideEffectClass(capabilityId: string): "none" | "owner_attention" | "external_write";
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
export declare function validateGuardSchema(guardSchemaJson: string | Record<string, unknown> | ToolRoutineGuardSchema | undefined, context: {
    triggerCapabilities?: string[];
    capabilityPattern?: string;
}): GuardValidationResult;
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
export declare function parseRoutineSteps(stepsJson: string | undefined): StepsParseResult;
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
export declare function validateSandboxCompliance(stepsJson: string | undefined, guard: ToolRoutineGuardSchema): SandboxValidationResult;
export declare function routineSourceRef(routineId: string, label?: string): SourceRef;
export declare function ledgerSourceRef(ledgerId: string): SourceRef;
