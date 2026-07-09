/**
 * v9 ToolRoutineRegistry — Routine lifecycle, invocation port & trace (T6.2.2).
 *
 * Core logic:
 * - `installToolRoutine`: validate guard syntax + sandbox compliance, persist
 *   active routine, write ledger entry, return active routine with ledger ref.
 * - `invokeToolRoutine`: load active routine, re-check invocation-time policy
 *   gate, parse steps, execute declarative steps (scriptable execution is
 *   owned by T6.3.x connector evolution), persist RoutineExecutionTrace.
 * - `retireToolRoutine`: transition active → retired with timestamp.
 * - `listRoutines` / `loadActive`: read-model ports for affordance & ops.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §2 §3.5 §3.6`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §6 §6.3 §6.4`
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (routine contracts)
 * - `src/core/second-nature/body/tool-routine/v9-routine-validation.js`
 * - `src/storage/v9-state-stores.js` (via ports)
 *
 * Boundary:
 * - Does NOT evaluate invocation-time policy context; receives `policyAllowed`
 *   from caller (action-closure-policy-system's `evaluateV9ActionPolicy`).
 * - Does NOT execute scriptable adapter steps; records them as `skipped` in
 *   trace until T6.3.x connector evolution provides the sandboxed executor.
 * - Ledger write is delegated to an injected port so registry stays testable.
 *
 * Test coverage:
 * - `tests/unit/body/v9-tool-routine-registry.test.ts`
 * - `tests/integration/v9/tool-routine-install-invoke.test.ts`
 */

import type {
  RoutineCandidate,
  RoutineInstallResult,
  RoutineInvocationContext,
  RoutineInvocationResult,
  RoutineRegistryStatus,
  RoutineStep,
  RoutineStepTrace,
  SourceRef,
  ToolRoutine,
  ToolRoutineGuardSchema,
  ToolRoutineReadModel,
  V9ReasonCode,
} from "../../../../shared/types/v9-contracts.js";
import {
  validateGuardSchema,
  validateSandboxCompliance,
  parseRoutineSteps,
  routineSourceRef,
  ledgerSourceRef,
} from "./v9-routine-validation.js";

// ───────────────────────────────────────────────────────────────
// Ports (injected dependencies for testability)
// ───────────────────────────────────────────────────────────────

export interface ToolRoutineRegistryPorts {
  /** Persist a routine row. */
  writeRoutine(record: RoutineRecordWrite): Promise<ToolRoutineRecordRow>;
  /** Read a routine by id. */
  readRoutineById(id: string): Promise<ToolRoutineRecordRow | undefined>;
  /** Read active routines by capability pattern (used by affordance). */
  readActiveByCapabilityPattern(capabilityPattern: string): Promise<ToolRoutineRecordRow[]>;
  /** Read routines by status. */
  readByStatus(status: RoutineRegistryStatus): Promise<ToolRoutineRecordRow[]>;
  /** Update routine status + lifecycle timestamps. */
  updateRoutineStatus(
    id: string,
    status: RoutineRegistryStatus,
    patch?: Partial<Pick<ToolRoutineRecordRow, "activatedAt" | "retiredAt" | "ledgerRef">>,
  ): Promise<ToolRoutineRecordRow | undefined>;
  /** Persist a routine execution trace row. */
  writeTrace(trace: RoutineTraceWrite): Promise<RoutineTraceRow>;
  /** Read traces by routine id. */
  readTracesByRoutine(routineId: string, limit?: number): Promise<RoutineTraceRow[]>;
}

/**
 * Storage row shape (mirrors `tool_routine` table columns + deserialized payload).
 */
export interface ToolRoutineRecordRow {
  id: string;
  name: string;
  version: string;
  capabilityPattern: string;
  status: RoutineRegistryStatus;
  sourceRefs: SourceRef[];
  rollbackRef?: string;
  guardRefs?: SourceRef[];
  ledgerRef?: string;
  redactionClass: string;
  // Deserialized payload fields:
  triggerCapabilities?: string[];
  triggerConditionsJson?: string;
  stepsJson?: string;
  guardSchemaJson?: string;
  activatedAt?: string;
  retiredAt?: string;
  createdAt: string;
}

export interface RoutineRecordWrite {
  id: string;
  name: string;
  version: string;
  capabilityPattern: string;
  status: RoutineRegistryStatus;
  sourceRefs: SourceRef[];
  rollbackRef?: string;
  guardRefs?: SourceRef[];
  ledgerRef?: string;
  redactionClass?: string;
  triggerCapabilities?: string[];
  triggerConditionsJson?: string;
  stepsJson?: string;
  guardSchemaJson?: string;
  activatedAt?: string;
  retiredAt?: string;
  createdAt: string;
}

export interface RoutineTraceWrite {
  id: string;
  routineId: string;
  cycleId: string;
  status: "executed" | "denied";
  sourceRefs: SourceRef[];
  proofRefs?: SourceRef[];
  traceRefs?: SourceRef[];
  payloadJson?: string;
  createdAt: string;
}

export interface RoutineTraceRow {
  id: string;
  routineId: string;
  cycleId: string;
  status: "executed" | "denied";
  sourceRefs: SourceRef[];
  proofRefs?: SourceRef[];
  traceRefs?: SourceRef[];
  payloadJson?: string;
  createdAt: string;
}

export interface LedgerWritePort {
  writeLedgerEntry(entry: {
    id: string;
    workspaceRoot: string;
    changeKind: "routine_install" | "routine_supersede" | "routine_retire";
    targetId: string;
    previousStableRef?: string;
    status?: "proposed" | "gated" | "activated" | "rolled_back" | "blocked";
    sourceRefs: SourceRef[];
    redactedPayloadJson?: string;
    createdAt: string;
    activatedAt?: string;
  }): Promise<{ id: string }>;
}

export interface RoutinePolicyGate {
  allowed: boolean;
  reason?: V9ReasonCode;
}

export interface ToolRoutineRegistryDeps {
  ports: ToolRoutineRegistryPorts;
  ledger: LedgerWritePort;
  /** Generate unique ids for routine versions + traces + ledger entries. */
  generateId?: () => string;
  /** Clock for timestamps. */
  now?: () => string;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function defaultGenerateId(): string {
  return `rtn_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function rowToToolRoutine(row: ToolRoutineRecordRow): ToolRoutine {
  return {
    id: row.id,
    routineId: row.id, // id === routineId per schema design
    name: row.name,
    version: row.version,
    capabilityPattern: row.capabilityPattern,
    triggerCapabilities: row.triggerCapabilities ?? [],
    triggerConditionsJson: row.triggerConditionsJson ?? "",
    stepsJson: row.stepsJson ?? "",
    guardSchemaJson: row.guardSchemaJson ?? "",
    rollbackRef: row.rollbackRef ?? "",
    status: row.status,
    sourceRefs: row.sourceRefs,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    retiredAt: row.retiredAt,
  };
}

function rowToReadModel(row: ToolRoutineRecordRow): ToolRoutineReadModel {
  return {
    routineId: row.id,
    capabilityPattern: row.capabilityPattern,
    triggerCapabilities: row.triggerCapabilities ?? [],
    version: row.version,
    status: row.status,
    sourceRefs: row.sourceRefs,
    // ToolRoutineReadModel.rollbackRef is SourceRef; ToolRoutine.rollbackRef is string.
    // Adapt at the read-model boundary: wrap the ref string as a routine-family SourceRef.
    rollbackRef: row.rollbackRef ? { family: "routine", id: row.rollbackRef } : undefined,
    guardSchemaJson: row.guardSchemaJson,
  };
}

// ───────────────────────────────────────────────────────────────
// installToolRoutine (§3.5)
// ───────────────────────────────────────────────────────────────

export async function installToolRoutine(
  candidate: RoutineCandidate,
  policyGate: RoutinePolicyGate,
  deps: ToolRoutineRegistryDeps,
): Promise<RoutineInstallResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const generateId = deps.generateId ?? defaultGenerateId;
  const createdAt = now();

  // 1. Policy gate already evaluated by action-closure-policy-system.
  if (!policyGate.allowed) {
    return {
      status: "denied",
      reason: policyGate.reason ?? "routine_permission_expansion_denied",
      sourceRefs: candidate.sourceRefs,
    };
  }

  // 2. Guard schema syntax + permission-expansion validation.
  const guardResult = validateGuardSchema(candidate.guardSchemaJson, {
    triggerCapabilities: candidate.triggerCapabilities,
    capabilityPattern: candidate.capabilityPattern,
  });
  if (!guardResult.ok) {
    return {
      status: "denied",
      reason: guardResult.reason,
      sourceRefs: candidate.sourceRefs,
      detail: guardResult.detail,
    };
  }
  const guard = guardResult.guard;

  // 3. Sandbox compliance validation.
  // §6.3 authoritative reason code enum has `routine_guard_schema_invalid` covering
  // guard schema + sandbox policy failures; §3.5 pseudocode's `routine_guard_sandbox_failed`
  // is folded into `routine_guard_schema_invalid` with detail preserving the sandbox cause.
  const sandboxResult = validateSandboxCompliance(candidate.stepsJson, guard);
  if (!sandboxResult.ok) {
    return {
      status: "denied",
      reason: "routine_guard_schema_invalid",
      sourceRefs: candidate.sourceRefs,
      detail: sandboxResult.detail ?? sandboxResult.reason,
    };
  }

  // 4. Persist active routine.
  const routineId = candidate.routineId;
  const record: RoutineRecordWrite = {
    id: routineId,
    name: candidate.name,
    version: candidate.version,
    capabilityPattern: candidate.capabilityPattern,
    status: "active",
    sourceRefs: candidate.sourceRefs,
    rollbackRef: candidate.rollbackRef,
    guardRefs: [routineSourceRef(routineId, "guard_schema_validated")],
    redactionClass: "none",
    triggerCapabilities: candidate.triggerCapabilities,
    triggerConditionsJson: candidate.triggerConditionsJson,
    stepsJson: candidate.stepsJson,
    guardSchemaJson: candidate.guardSchemaJson,
    activatedAt: createdAt,
    createdAt,
  };
  await deps.ports.writeRoutine(record);

  // 5. Write ledger entry.
  const ledgerId = generateId();
  const changeKind: "routine_install" | "routine_supersede" = candidate.previousRoutineId
    ? "routine_supersede"
    : "routine_install";
  const ledgerEntry = {
    id: ledgerId,
    workspaceRoot: candidate.workspaceRoot,
    changeKind,
    targetId: routineId,
    previousStableRef: candidate.previousRoutineId,
    status: "activated" as const,
    sourceRefs: [
      routineSourceRef(routineId),
      ...candidate.sourceRefs,
    ],
    redactedPayloadJson: JSON.stringify({
      name: candidate.name,
      triggerCapabilities: candidate.triggerCapabilities,
    }),
    createdAt,
    activatedAt: createdAt,
  };
  await deps.ledger.writeLedgerEntry(ledgerEntry);

  // 6. Link ledger ref back to routine row.
  await deps.ports.updateRoutineStatus(routineId, "active", { ledgerRef: ledgerId });

  const routine: ToolRoutine = {
    id: routineId,
    routineId,
    name: candidate.name,
    version: candidate.version,
    capabilityPattern: candidate.capabilityPattern,
    triggerCapabilities: candidate.triggerCapabilities,
    triggerConditionsJson: candidate.triggerConditionsJson,
    stepsJson: candidate.stepsJson,
    guardSchemaJson: candidate.guardSchemaJson,
    rollbackRef: candidate.rollbackRef,
    status: "active",
    sourceRefs: candidate.sourceRefs,
    createdAt,
    activatedAt: createdAt,
  };

  return {
    status: "active",
    routine,
    ledgerRef: ledgerId,
    sourceRefs: [...candidate.sourceRefs, ledgerSourceRef(ledgerId)],
  };
}

// ───────────────────────────────────────────────────────────────
// invokeToolRoutine (§3.6)
// ───────────────────────────────────────────────────────────────

export async function invokeToolRoutine(
  routineId: string,
  ctx: RoutineInvocationContext,
  deps: ToolRoutineRegistryDeps,
): Promise<RoutineInvocationResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const generateId = deps.generateId ?? defaultGenerateId;
  const createdAt = ctx.now ?? now();

  // 1. Load active routine.
  const row = await deps.ports.readRoutineById(routineId);
  if (!row || row.status !== "active") {
    return {
      status: "denied",
      reason: "routine_invocation_denied",
      routineId,
      sourceRefs: ctx.sourceRefs,
    };
  }
  const routine = rowToToolRoutine(row);

  // 2. Invocation-time policy gate (already evaluated by caller).
  if (!ctx.policyAllowed) {
    const traceId = generateId();
    const deniedTrace: RoutineTraceWrite = {
      id: traceId,
      routineId,
      cycleId: ctx.cycleId,
      status: "denied",
      sourceRefs: ctx.sourceRefs,
      proofRefs: [routineSourceRef(routineId)],
      payloadJson: JSON.stringify({ reason: ctx.policyReason ?? "routine_guard_policy_denied" }),
      createdAt,
    };
    await deps.ports.writeTrace(deniedTrace);
    return {
      status: "denied",
      reason: ctx.policyReason ?? "routine_guard_policy_denied",
      traceId,
      routineId,
      sourceRefs: ctx.sourceRefs,
    };
  }

  // 3. Parse steps.
  const stepsParsed = parseRoutineSteps(routine.stepsJson || undefined);
  if (!stepsParsed.ok) {
    const traceId = generateId();
    const deniedTrace: RoutineTraceWrite = {
      id: traceId,
      routineId,
      cycleId: ctx.cycleId,
      status: "denied",
      sourceRefs: ctx.sourceRefs,
      proofRefs: [routineSourceRef(routineId)],
      payloadJson: JSON.stringify({ reason: "routine_guard_schema_invalid", detail: stepsParsed.reason }),
      createdAt,
    };
    await deps.ports.writeTrace(deniedTrace);
    return {
      status: "denied",
      reason: "routine_guard_schema_invalid",
      traceId,
      routineId,
      sourceRefs: ctx.sourceRefs,
    };
  }
  const steps = stepsParsed.steps;

  // 4. Execute steps. Scriptable steps are recorded as `skipped` until T6.3.x
  //    provides the sandboxed adapter executor; declarative steps are recorded
  //    as `success` (parameter-only, no external side effect).
  const trace: RoutineStepTrace[] = [];
  for (const step of steps) {
    const stepTrace = executeStep(step, ctx);
    trace.push(stepTrace);
    if (stepTrace.outcome === "failure") break;
  }

  // 5. Persist trace.
  const traceId = generateId();
  const traceRow: RoutineTraceWrite = {
    id: traceId,
    routineId,
    cycleId: ctx.cycleId,
    status: "executed",
    sourceRefs: ctx.sourceRefs,
    proofRefs: [routineSourceRef(routineId)],
    traceRefs: trace.map((t) => ({ family: "action" as const, id: t.stepId, label: t.outcome })),
    payloadJson: JSON.stringify({ steps: trace, payload: ctx.payload }),
    createdAt,
  };
  await deps.ports.writeTrace(traceRow);

  return {
    status: "executed",
    trace,
    traceId,
    routineId,
    sourceRefs: ctx.sourceRefs,
  };
}

function executeStep(step: RoutineStep, _ctx: RoutineInvocationContext): RoutineStepTrace {
  // Scriptable steps require the sandboxed adapter executor (T6.3.x).
  // Until then, record as skipped so trace is honest about what ran.
  if (step.kind === "scriptable") {
    return {
      stepId: step.stepId,
      capabilityId: step.capabilityId,
      outcome: "skipped",
      detail: "scriptable_executor_pending_T6_3_x",
    };
  }
  // Declarative steps are parameter-only; no external side effect to execute
  // in the registry spine. Real connector calls happen via executeConnectorRequest.
  return {
    stepId: step.stepId,
    capabilityId: step.capabilityId,
    outcome: "success",
  };
}

// ───────────────────────────────────────────────────────────────
// retireToolRoutine
// ───────────────────────────────────────────────────────────────

export async function retireToolRoutine(
  routineId: string,
  deps: ToolRoutineRegistryDeps & { workspaceRoot: string },
): Promise<{ ok: true; retiredAt: string } | { ok: false; reason: V9ReasonCode }> {
  const now = deps.now ?? (() => new Date().toISOString());
  const generateId = deps.generateId ?? defaultGenerateId;
  const retiredAt = now();

  const row = await deps.ports.readRoutineById(routineId);
  if (!row) {
    return { ok: false, reason: "routine_invocation_denied" };
  }
  if (row.status !== "active") {
    return { ok: false, reason: "routine_invocation_denied" };
  }

  await deps.ports.updateRoutineStatus(routineId, "retired", { retiredAt });

  // Ledger entry for retire.
  const ledgerId = generateId();
  await deps.ledger.writeLedgerEntry({
    id: ledgerId,
    workspaceRoot: deps.workspaceRoot,
    changeKind: "routine_retire",
    targetId: routineId,
    previousStableRef: row.rollbackRef,
    status: "activated",
    sourceRefs: [routineSourceRef(routineId), ...row.sourceRefs],
    redactedPayloadJson: JSON.stringify({ name: row.name, version: row.version }),
    createdAt: retiredAt,
    activatedAt: retiredAt,
  });

  return { ok: true, retiredAt };
}

// ───────────────────────────────────────────────────────────────
// Read-model ports
// ───────────────────────────────────────────────────────────────

export async function loadActiveRoutine(
  routineId: string,
  deps: ToolRoutineRegistryDeps,
): Promise<ToolRoutine | undefined> {
  const row = await deps.ports.readRoutineById(routineId);
  if (!row || row.status !== "active") return undefined;
  return rowToToolRoutine(row);
}

export async function listRoutinesByStatus(
  status: RoutineRegistryStatus,
  deps: ToolRoutineRegistryDeps,
): Promise<ToolRoutineReadModel[]> {
  const rows = await deps.ports.readByStatus(status);
  return rows.map(rowToReadModel);
}

export async function listActiveRoutinesByCapabilityPattern(
  capabilityPattern: string,
  deps: ToolRoutineRegistryDeps,
): Promise<ToolRoutineReadModel[]> {
  const rows = await deps.ports.readActiveByCapabilityPattern(capabilityPattern);
  return rows.map(rowToReadModel);
}

export async function readRoutineTraces(
  routineId: string,
  deps: ToolRoutineRegistryDeps,
  limit = 50,
): Promise<RoutineTraceRow[]> {
  return deps.ports.readTracesByRoutine(routineId, limit);
}

// ───────────────────────────────────────────────────────────────
// State-store backed ports factory
// ───────────────────────────────────────────────────────────────

import type { StateDatabase } from "../../../../storage/db/index.js";
import {
  writeToolRoutine,
  readToolRoutineById,
  readActiveToolRoutinesByCapabilityPattern,
  readToolRoutinesByStatus,
  updateToolRoutineStatus,
  writeRoutineExecutionTrace,
  readRoutineExecutionTracesByRoutine,
  writeAutonomousChangeLedger,
} from "../../../../storage/v9-state-stores.js";

/**
 * Deserialize a `tool_routine` storage row (with `payloadJson` catch-all)
 * into the registry's `ToolRoutineRecordRow` shape.
 */
function storageRowToRecordRow(row: {
  id: string;
  name: string;
  version: string;
  capabilityPattern: string;
  status: RoutineRegistryStatus;
  sourceRefsJson: string | null;
  rollbackRef: string | null;
  guardRefsJson: string | null;
  ledgerRef: string | null;
  redactionClass: string;
  payloadJson: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
}): ToolRoutineRecordRow {
  let payload: Record<string, unknown> = {};
  if (row.payloadJson) {
    try {
      const parsed = JSON.parse(row.payloadJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = {};
    }
  }
  let guardRefs: SourceRef[] | undefined;
  if (row.guardRefsJson) {
    try {
      const parsed = JSON.parse(row.guardRefsJson);
      if (Array.isArray(parsed)) guardRefs = parsed as SourceRef[];
    } catch {
      guardRefs = undefined;
    }
  }
  let sourceRefs: SourceRef[] = [];
  if (row.sourceRefsJson) {
    try {
      const parsed = JSON.parse(row.sourceRefsJson);
      if (Array.isArray(parsed)) sourceRefs = parsed as SourceRef[];
    } catch {
      sourceRefs = [];
    }
  }
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    capabilityPattern: row.capabilityPattern,
    status: row.status,
    sourceRefs,
    rollbackRef: row.rollbackRef ?? undefined,
    guardRefs,
    ledgerRef: row.ledgerRef ?? undefined,
    redactionClass: row.redactionClass,
    triggerCapabilities: Array.isArray(payload.triggerCapabilities)
      ? (payload.triggerCapabilities as string[])
      : undefined,
    triggerConditionsJson:
      typeof payload.triggerConditionsJson === "string"
        ? payload.triggerConditionsJson
        : undefined,
    stepsJson: typeof payload.stepsJson === "string" ? payload.stepsJson : undefined,
    guardSchemaJson:
      typeof payload.guardSchemaJson === "string" ? payload.guardSchemaJson : undefined,
    activatedAt: row.activatedAt ?? undefined,
    retiredAt: row.retiredAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function traceRowToTrace(row: {
  id: string;
  routineId: string;
  cycleId: string;
  status: string;
  sourceRefsJson: string | null;
  proofRefsJson: string | null;
  traceRefsJson: string | null;
  payloadJson: string | null;
  createdAt: string;
}): RoutineTraceRow {
  let sourceRefs: SourceRef[] = [];
  if (row.sourceRefsJson) {
    try {
      const parsed = JSON.parse(row.sourceRefsJson);
      if (Array.isArray(parsed)) sourceRefs = parsed as SourceRef[];
    } catch {
      sourceRefs = [];
    }
  }
  let proofRefs: SourceRef[] | undefined;
  if (row.proofRefsJson) {
    try {
      const parsed = JSON.parse(row.proofRefsJson);
      if (Array.isArray(parsed)) proofRefs = parsed as SourceRef[];
    } catch {
      proofRefs = undefined;
    }
  }
  let traceRefs: SourceRef[] | undefined;
  if (row.traceRefsJson) {
    try {
      const parsed = JSON.parse(row.traceRefsJson);
      if (Array.isArray(parsed)) traceRefs = parsed as SourceRef[];
    } catch {
      traceRefs = undefined;
    }
  }
  return {
    id: row.id,
    routineId: row.routineId,
    cycleId: row.cycleId,
    status: row.status as "executed" | "denied",
    sourceRefs,
    proofRefs,
    traceRefs,
    payloadJson: row.payloadJson ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * Create registry ports backed by the real state-store functions.
 */
export function createStateStoreRegistryPorts(
  db: StateDatabase,
): ToolRoutineRegistryPorts {
  return {
    async writeRoutine(record: RoutineRecordWrite): Promise<ToolRoutineRecordRow> {
      const row = await writeToolRoutine(db, {
        id: record.id,
        name: record.name,
        version: record.version,
        capabilityPattern: record.capabilityPattern,
        status: record.status,
        sourceRefs: record.sourceRefs,
        rollbackRef: record.rollbackRef,
        guardRefs: record.guardRefs,
        ledgerRef: record.ledgerRef,
        redactionClass: record.redactionClass as
          | "none"
          | "owner_attention"
          | "external_write"
          | undefined,
        triggerCapabilities: record.triggerCapabilities,
        triggerConditionsJson: record.triggerConditionsJson,
        stepsJson: record.stepsJson,
        guardSchemaJson: record.guardSchemaJson,
        activatedAt: record.activatedAt,
        retiredAt: record.retiredAt,
        createdAt: record.createdAt,
      });
      return storageRowToRecordRow({
        id: row.id,
        name: row.name,
        version: row.version,
        capabilityPattern: row.capabilityPattern,
        status: row.status as RoutineRegistryStatus,
        sourceRefsJson: row.sourceRefsJson as string | null,
        rollbackRef: row.rollbackRef as string | null,
        guardRefsJson: row.guardRefsJson as string | null,
        ledgerRef: row.ledgerRef as string | null,
        redactionClass: row.redactionClass,
        payloadJson: row.payloadJson as string | null,
        activatedAt: row.activatedAt as string | null,
        retiredAt: row.retiredAt as string | null,
        createdAt: row.createdAt,
      });
    },
    async readRoutineById(id: string): Promise<ToolRoutineRecordRow | undefined> {
      const row = await readToolRoutineById(db, id);
      if (!row) return undefined;
      return storageRowToRecordRow({
        id: row.id,
        name: row.name,
        version: row.version,
        capabilityPattern: row.capabilityPattern,
        status: row.status as RoutineRegistryStatus,
        sourceRefsJson: row.sourceRefsJson as string | null,
        rollbackRef: row.rollbackRef as string | null,
        guardRefsJson: row.guardRefsJson as string | null,
        ledgerRef: row.ledgerRef as string | null,
        redactionClass: row.redactionClass,
        payloadJson: row.payloadJson as string | null,
        activatedAt: row.activatedAt as string | null,
        retiredAt: row.retiredAt as string | null,
        createdAt: row.createdAt,
      });
    },
    async readActiveByCapabilityPattern(
      capabilityPattern: string,
    ): Promise<ToolRoutineRecordRow[]> {
      const rows = await readActiveToolRoutinesByCapabilityPattern(db, capabilityPattern);
      return rows.map((row) =>
        storageRowToRecordRow({
          id: row.id,
          name: row.name,
          version: row.version,
          capabilityPattern: row.capabilityPattern,
          status: row.status as RoutineRegistryStatus,
          sourceRefsJson: row.sourceRefsJson as string | null,
          rollbackRef: row.rollbackRef as string | null,
          guardRefsJson: row.guardRefsJson as string | null,
          ledgerRef: row.ledgerRef as string | null,
          redactionClass: row.redactionClass,
          payloadJson: row.payloadJson as string | null,
          activatedAt: row.activatedAt as string | null,
          retiredAt: row.retiredAt as string | null,
          createdAt: row.createdAt,
        }),
      );
    },
    async readByStatus(status: RoutineRegistryStatus): Promise<ToolRoutineRecordRow[]> {
      const result = await readToolRoutinesByStatus(db, status as ToolRoutineRecordRow["status"]);
      return result.rows.map((row) =>
        storageRowToRecordRow({
          id: row.id,
          name: row.name,
          version: row.version,
          capabilityPattern: row.capabilityPattern,
          status: row.status as RoutineRegistryStatus,
          sourceRefsJson: row.sourceRefsJson as string | null,
          rollbackRef: row.rollbackRef as string | null,
          guardRefsJson: row.guardRefsJson as string | null,
          ledgerRef: row.ledgerRef as string | null,
          redactionClass: row.redactionClass,
          payloadJson: row.payloadJson as string | null,
          activatedAt: row.activatedAt as string | null,
          retiredAt: row.retiredAt as string | null,
          createdAt: row.createdAt,
        }),
      );
    },
    async updateRoutineStatus(
      id: string,
      status: RoutineRegistryStatus,
      patch?,
    ): Promise<ToolRoutineRecordRow | undefined> {
      const row = await updateToolRoutineStatus(db, id, status as ToolRoutineRecordRow["status"], patch);
      if (!row) return undefined;
      return storageRowToRecordRow({
        id: row.id,
        name: row.name,
        version: row.version,
        capabilityPattern: row.capabilityPattern,
        status: row.status as RoutineRegistryStatus,
        sourceRefsJson: row.sourceRefsJson as string | null,
        rollbackRef: row.rollbackRef as string | null,
        guardRefsJson: row.guardRefsJson as string | null,
        ledgerRef: row.ledgerRef as string | null,
        redactionClass: row.redactionClass,
        payloadJson: row.payloadJson as string | null,
        activatedAt: row.activatedAt as string | null,
        retiredAt: row.retiredAt as string | null,
        createdAt: row.createdAt,
      });
    },
    async writeTrace(trace: RoutineTraceWrite): Promise<RoutineTraceRow> {
      const row = await writeRoutineExecutionTrace(db, {
        id: trace.id,
        routineId: trace.routineId,
        cycleId: trace.cycleId,
        status: trace.status,
        sourceRefs: trace.sourceRefs,
        proofRefs: trace.proofRefs,
        traceRefs: trace.traceRefs,
        payloadJson: trace.payloadJson,
        createdAt: trace.createdAt,
      });
      return traceRowToTrace({
        id: row.id,
        routineId: row.routineId,
        cycleId: row.cycleId,
        status: row.status,
        sourceRefsJson: row.sourceRefsJson as string | null,
        proofRefsJson: row.proofRefsJson as string | null,
        traceRefsJson: row.traceRefsJson as string | null,
        payloadJson: row.payloadJson as string | null,
        createdAt: row.createdAt,
      });
    },
    async readTracesByRoutine(routineId: string, limit = 50): Promise<RoutineTraceRow[]> {
      const result = await readRoutineExecutionTracesByRoutine(db, routineId, limit);
      return result.rows.map((row) =>
        traceRowToTrace({
          id: row.id,
          routineId: row.routineId,
          cycleId: row.cycleId,
          status: row.status,
          sourceRefsJson: row.sourceRefsJson as string | null,
          proofRefsJson: row.proofRefsJson as string | null,
          traceRefsJson: row.traceRefsJson as string | null,
          payloadJson: row.payloadJson as string | null,
          createdAt: row.createdAt,
        }),
      );
    },
  };
}

/**
 * State-store backed ledger write port.
 */
export function createStateStoreLedgerPort(db: StateDatabase): LedgerWritePort {
  return {
    async writeLedgerEntry(entry) {
      const row = await writeAutonomousChangeLedger(db, {
        id: entry.id,
        createdAt: entry.createdAt,
        workspaceRoot: entry.workspaceRoot,
        changeKind: entry.changeKind,
        targetId: entry.targetId,
        previousStableRef: entry.previousStableRef,
        status: entry.status,
        sourceRefs: entry.sourceRefs,
        redactedPayloadJson: entry.redactedPayloadJson,
        activatedAt: entry.activatedAt,
      });
      return { id: row.id };
    },
  };
}
