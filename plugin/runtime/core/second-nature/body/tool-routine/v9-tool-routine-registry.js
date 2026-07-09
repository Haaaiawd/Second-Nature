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
import { validateGuardSchema, validateSandboxCompliance, parseRoutineSteps, routineSourceRef, ledgerSourceRef, } from "./v9-routine-validation.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function defaultGenerateId() {
    return `rtn_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}
function rowToToolRoutine(row) {
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
function rowToReadModel(row) {
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
export async function installToolRoutine(candidate, policyGate, deps) {
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
    const record = {
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
    const changeKind = candidate.previousRoutineId
        ? "routine_supersede"
        : "routine_install";
    const ledgerEntry = {
        id: ledgerId,
        workspaceRoot: candidate.workspaceRoot,
        changeKind,
        targetId: routineId,
        previousStableRef: candidate.previousRoutineId,
        status: "activated",
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
    const routine = {
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
export async function invokeToolRoutine(routineId, ctx, deps) {
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
        const deniedTrace = {
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
        const deniedTrace = {
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
    const trace = [];
    for (const step of steps) {
        const stepTrace = executeStep(step, ctx);
        trace.push(stepTrace);
        if (stepTrace.outcome === "failure")
            break;
    }
    // 5. Persist trace.
    const traceId = generateId();
    const traceRow = {
        id: traceId,
        routineId,
        cycleId: ctx.cycleId,
        status: "executed",
        sourceRefs: ctx.sourceRefs,
        proofRefs: [routineSourceRef(routineId)],
        traceRefs: trace.map((t) => ({ family: "action", id: t.stepId, label: t.outcome })),
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
function executeStep(step, _ctx) {
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
export async function retireToolRoutine(routineId, deps) {
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
export async function loadActiveRoutine(routineId, deps) {
    const row = await deps.ports.readRoutineById(routineId);
    if (!row || row.status !== "active")
        return undefined;
    return rowToToolRoutine(row);
}
export async function listRoutinesByStatus(status, deps) {
    const rows = await deps.ports.readByStatus(status);
    return rows.map(rowToReadModel);
}
export async function listActiveRoutinesByCapabilityPattern(capabilityPattern, deps) {
    const rows = await deps.ports.readActiveByCapabilityPattern(capabilityPattern);
    return rows.map(rowToReadModel);
}
export async function readRoutineTraces(routineId, deps, limit = 50) {
    return deps.ports.readTracesByRoutine(routineId, limit);
}
import { writeToolRoutine, readToolRoutineById, readActiveToolRoutinesByCapabilityPattern, readToolRoutinesByStatus, updateToolRoutineStatus, writeRoutineExecutionTrace, readRoutineExecutionTracesByRoutine, writeAutonomousChangeLedger, } from "../../../../storage/v9-state-stores.js";
/**
 * Deserialize a `tool_routine` storage row (with `payloadJson` catch-all)
 * into the registry's `ToolRoutineRecordRow` shape.
 */
function storageRowToRecordRow(row) {
    let payload = {};
    if (row.payloadJson) {
        try {
            const parsed = JSON.parse(row.payloadJson);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                payload = parsed;
            }
        }
        catch {
            payload = {};
        }
    }
    let guardRefs;
    if (row.guardRefsJson) {
        try {
            const parsed = JSON.parse(row.guardRefsJson);
            if (Array.isArray(parsed))
                guardRefs = parsed;
        }
        catch {
            guardRefs = undefined;
        }
    }
    let sourceRefs = [];
    if (row.sourceRefsJson) {
        try {
            const parsed = JSON.parse(row.sourceRefsJson);
            if (Array.isArray(parsed))
                sourceRefs = parsed;
        }
        catch {
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
            ? payload.triggerCapabilities
            : undefined,
        triggerConditionsJson: typeof payload.triggerConditionsJson === "string"
            ? payload.triggerConditionsJson
            : undefined,
        stepsJson: typeof payload.stepsJson === "string" ? payload.stepsJson : undefined,
        guardSchemaJson: typeof payload.guardSchemaJson === "string" ? payload.guardSchemaJson : undefined,
        activatedAt: row.activatedAt ?? undefined,
        retiredAt: row.retiredAt ?? undefined,
        createdAt: row.createdAt,
    };
}
function traceRowToTrace(row) {
    let sourceRefs = [];
    if (row.sourceRefsJson) {
        try {
            const parsed = JSON.parse(row.sourceRefsJson);
            if (Array.isArray(parsed))
                sourceRefs = parsed;
        }
        catch {
            sourceRefs = [];
        }
    }
    let proofRefs;
    if (row.proofRefsJson) {
        try {
            const parsed = JSON.parse(row.proofRefsJson);
            if (Array.isArray(parsed))
                proofRefs = parsed;
        }
        catch {
            proofRefs = undefined;
        }
    }
    let traceRefs;
    if (row.traceRefsJson) {
        try {
            const parsed = JSON.parse(row.traceRefsJson);
            if (Array.isArray(parsed))
                traceRefs = parsed;
        }
        catch {
            traceRefs = undefined;
        }
    }
    return {
        id: row.id,
        routineId: row.routineId,
        cycleId: row.cycleId,
        status: row.status,
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
export function createStateStoreRegistryPorts(db) {
    return {
        async writeRoutine(record) {
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
                redactionClass: record.redactionClass,
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
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                rollbackRef: row.rollbackRef,
                guardRefsJson: row.guardRefsJson,
                ledgerRef: row.ledgerRef,
                redactionClass: row.redactionClass,
                payloadJson: row.payloadJson,
                activatedAt: row.activatedAt,
                retiredAt: row.retiredAt,
                createdAt: row.createdAt,
            });
        },
        async readRoutineById(id) {
            const row = await readToolRoutineById(db, id);
            if (!row)
                return undefined;
            return storageRowToRecordRow({
                id: row.id,
                name: row.name,
                version: row.version,
                capabilityPattern: row.capabilityPattern,
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                rollbackRef: row.rollbackRef,
                guardRefsJson: row.guardRefsJson,
                ledgerRef: row.ledgerRef,
                redactionClass: row.redactionClass,
                payloadJson: row.payloadJson,
                activatedAt: row.activatedAt,
                retiredAt: row.retiredAt,
                createdAt: row.createdAt,
            });
        },
        async readActiveByCapabilityPattern(capabilityPattern) {
            const rows = await readActiveToolRoutinesByCapabilityPattern(db, capabilityPattern);
            return rows.map((row) => storageRowToRecordRow({
                id: row.id,
                name: row.name,
                version: row.version,
                capabilityPattern: row.capabilityPattern,
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                rollbackRef: row.rollbackRef,
                guardRefsJson: row.guardRefsJson,
                ledgerRef: row.ledgerRef,
                redactionClass: row.redactionClass,
                payloadJson: row.payloadJson,
                activatedAt: row.activatedAt,
                retiredAt: row.retiredAt,
                createdAt: row.createdAt,
            }));
        },
        async readByStatus(status) {
            const result = await readToolRoutinesByStatus(db, status);
            return result.rows.map((row) => storageRowToRecordRow({
                id: row.id,
                name: row.name,
                version: row.version,
                capabilityPattern: row.capabilityPattern,
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                rollbackRef: row.rollbackRef,
                guardRefsJson: row.guardRefsJson,
                ledgerRef: row.ledgerRef,
                redactionClass: row.redactionClass,
                payloadJson: row.payloadJson,
                activatedAt: row.activatedAt,
                retiredAt: row.retiredAt,
                createdAt: row.createdAt,
            }));
        },
        async updateRoutineStatus(id, status, patch) {
            const row = await updateToolRoutineStatus(db, id, status, patch);
            if (!row)
                return undefined;
            return storageRowToRecordRow({
                id: row.id,
                name: row.name,
                version: row.version,
                capabilityPattern: row.capabilityPattern,
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                rollbackRef: row.rollbackRef,
                guardRefsJson: row.guardRefsJson,
                ledgerRef: row.ledgerRef,
                redactionClass: row.redactionClass,
                payloadJson: row.payloadJson,
                activatedAt: row.activatedAt,
                retiredAt: row.retiredAt,
                createdAt: row.createdAt,
            });
        },
        async writeTrace(trace) {
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
                sourceRefsJson: row.sourceRefsJson,
                proofRefsJson: row.proofRefsJson,
                traceRefsJson: row.traceRefsJson,
                payloadJson: row.payloadJson,
                createdAt: row.createdAt,
            });
        },
        async readTracesByRoutine(routineId, limit = 50) {
            const result = await readRoutineExecutionTracesByRoutine(db, routineId, limit);
            return result.rows.map((row) => traceRowToTrace({
                id: row.id,
                routineId: row.routineId,
                cycleId: row.cycleId,
                status: row.status,
                sourceRefsJson: row.sourceRefsJson,
                proofRefsJson: row.proofRefsJson,
                traceRefsJson: row.traceRefsJson,
                payloadJson: row.payloadJson,
                createdAt: row.createdAt,
            }));
        },
    };
}
/**
 * State-store backed ledger write port.
 */
export function createStateStoreLedgerPort(db) {
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
