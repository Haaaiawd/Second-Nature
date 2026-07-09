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
import type { RoutineCandidate, RoutineInstallResult, RoutineInvocationContext, RoutineInvocationResult, RoutineRegistryStatus, SourceRef, ToolRoutine, ToolRoutineReadModel, V9ReasonCode } from "../../../../shared/types/v9-contracts.js";
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
    updateRoutineStatus(id: string, status: RoutineRegistryStatus, patch?: Partial<Pick<ToolRoutineRecordRow, "activatedAt" | "retiredAt" | "ledgerRef">>): Promise<ToolRoutineRecordRow | undefined>;
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
    }): Promise<{
        id: string;
    }>;
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
export declare function installToolRoutine(candidate: RoutineCandidate, policyGate: RoutinePolicyGate, deps: ToolRoutineRegistryDeps): Promise<RoutineInstallResult>;
export declare function invokeToolRoutine(routineId: string, ctx: RoutineInvocationContext, deps: ToolRoutineRegistryDeps): Promise<RoutineInvocationResult>;
export declare function retireToolRoutine(routineId: string, deps: ToolRoutineRegistryDeps & {
    workspaceRoot: string;
}): Promise<{
    ok: true;
    retiredAt: string;
} | {
    ok: false;
    reason: V9ReasonCode;
}>;
export declare function loadActiveRoutine(routineId: string, deps: ToolRoutineRegistryDeps): Promise<ToolRoutine | undefined>;
export declare function listRoutinesByStatus(status: RoutineRegistryStatus, deps: ToolRoutineRegistryDeps): Promise<ToolRoutineReadModel[]>;
export declare function listActiveRoutinesByCapabilityPattern(capabilityPattern: string, deps: ToolRoutineRegistryDeps): Promise<ToolRoutineReadModel[]>;
export declare function readRoutineTraces(routineId: string, deps: ToolRoutineRegistryDeps, limit?: number): Promise<RoutineTraceRow[]>;
import type { StateDatabase } from "../../../../storage/db/index.js";
/**
 * Create registry ports backed by the real state-store functions.
 */
export declare function createStateStoreRegistryPorts(db: StateDatabase): ToolRoutineRegistryPorts;
/**
 * State-store backed ledger write port.
 */
export declare function createStateStoreLedgerPort(db: StateDatabase): LedgerWritePort;
