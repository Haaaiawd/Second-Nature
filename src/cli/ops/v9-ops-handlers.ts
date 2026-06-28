/**
 * v9 Ops Command Handlers (T1.2.1).
 *
 * Implements v9 ops command surface with JSON-first RuntimeOpsEnvelopeV9.
 *
 * Commands:
 * - continuity.read: SelfContinuityCard + CharacterFrameProjection
 * - routine.list: list routines with filter
 * - routine.show: show single routine
 * - routine.rollback: rollback routine (delegates to body-connector)
 * - connector_evolution.status: list evolution plans
 * - connector_evolution.trigger: trigger gate chain (delegates)
 * - connector_evolution.rollback: rollback connector version (delegates)
 * - loop_status.read: v9 loop status with activity health
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.detail.md §1-§5`
 * - `shared-v9-contracts.md §8`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (RuntimeOpsEnvelopeV9, ContinuityReadResult, etc.)
 * - `src/storage/v9-state-stores.js` (readToolRoutinesByStatus, readConnectorEvolutionPlansByStatus)
 * - `src/core/second-nature/memory/self-continuity-card-assembler.js` (createContinuityReadPort)
 * - `src/observability/v9-loop-health-aggregator.js` (aggregateLoopStatus)
 *
 * Boundary:
 * - Pure dispatch functions with injectable deps.
 * - All output wrapped in RuntimeOpsEnvelopeV9 with evidenceLevel + degradedReasons.
 * - Carrier mode returns honest degradation (§4.1).
 * - No raw credential/private/prompt in output (§3.3 redaction — T1.2.2).
 *
 * Test coverage: `tests/api/runtime-ops/v9-ops-surface.test.ts`
 */

import type {
  RuntimeOpsEnvelopeV9,
  EvidenceLevel,
  SurfaceMode,
  DegradedReason,
  RuntimeDiagnostics,
  ContinuityReadResult,
  RoutineReadModel,
  ConnectorEvolutionStatusReadModel,
  SourceRef,
  SelfContinuityCard,
  CharacterFrame,
  ConnectorEvolutionPlan,
  ConnectorEvolutionStatus,
  GateResult,
  ToolRoutine,
} from "../../shared/types/v9-contracts.js";
import {
  readToolRoutinesByStatus,
  readToolRoutineById,
  readConnectorEvolutionPlansByStatus,
  readConnectorEvolutionPlansByPlatform,
  readLatestSelfContinuityCard,
} from "../../storage/v9-state-stores.js";
import type {
  ToolRoutineRecord,
  ConnectorEvolutionPlanRecord,
} from "../../storage/db/schema/v9-entities.js";
import type { StateDatabase } from "../../storage/db/index.js";
import {
  aggregateLoopStatus,
  type LoopStatusResult,
  type LoopStatusInputs,
} from "../../observability/v9-loop-health-aggregator.js";

// ───────────────────────────────────────────────────────────────
// Deps
// ───────────────────────────────────────────────────────────────

export interface V9OpsHandlerDeps {
  state?: StateDatabase;
  workspaceRoot?: string;
  /** Surface mode: carrier (plugin schema only) vs full_runtime (CLI) vs workspace_full_runtime (plugin with deps). */
  surfaceMode: SurfaceMode;
  /** Injected clock for testing. */
  now?: () => Date;
  /** Loop status inputs provider (for loop_status.read). */
  loopStatusInputsProvider?: () => Promise<LoopStatusInputs>;
}

// ───────────────────────────────────────────────────────────────
// Envelope factory helpers
// ───────────────────────────────────────────────────────────────

function defaultNow(): Date {
  return new Date();
}

function makeEnvelope<T>(
  command: string,
  ok: boolean,
  payload: T,
  surfaceMode: SurfaceMode,
  sourceRefs: SourceRef[] = [],
  degradedReasons: DegradedReason[] = [],
  diagnostics: Partial<RuntimeDiagnostics> = {},
  evidenceLevel?: EvidenceLevel,
  now: Date = defaultNow(),
): RuntimeOpsEnvelopeV9<T> {
  const level: EvidenceLevel = evidenceLevel ?? defaultEvidenceLevel(surfaceMode);
  return {
    ok,
    command,
    evidenceLevel: level,
    surfaceMode,
    payload,
    degradedReasons,
    diagnostics: { surfaceMode, ...diagnostics },
    sourceRefs,
    generatedAt: now.toISOString(),
  };
}

function defaultEvidenceLevel(surfaceMode: SurfaceMode): EvidenceLevel {
  if (surfaceMode === "carrier") return "carrier_ack";
  return "contract_smoke";
}

function promoteEvidenceLevel(
  current: EvidenceLevel,
  hasSourceRefs: boolean,
  hasRealRuntimeProof: boolean,
  hasDurableAudit: boolean,
): EvidenceLevel {
  let level = current;
  if (hasSourceRefs) level = maxLevel(level, "state_present");
  if (hasRealRuntimeProof) level = maxLevel(level, "real_runtime");
  if (hasDurableAudit) level = maxLevel(level, "durable_verified");
  return level;
}

const LEVEL_ORDER: EvidenceLevel[] = ["carrier_ack", "contract_smoke", "state_present", "real_runtime", "durable_verified"];

function maxLevel(a: EvidenceLevel, b: EvidenceLevel): EvidenceLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

// ───────────────────────────────────────────────────────────────
// Command: continuity.read
// ───────────────────────────────────────────────────────────────

export async function handleContinuityRead(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<ContinuityReadResult>> {
  const now = deps.now ?? defaultNow;
  const workspaceRoot = input?.workspaceRoot ?? deps.workspaceRoot;

  if (!workspaceRoot) {
    return makeEnvelope(
      "continuity.read",
      false,
      { status: "unavailable", unavailableReason: "workspace_root_missing", sourceRefs: [] },
      deps.surfaceMode,
      [],
      [{ code: "workspace_root_missing", message: "workspaceRoot is required for continuity.read" }],
    );
  }

  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "continuity.read",
      false,
      { status: "unavailable", unavailableReason: "host_tool_unavailable", sourceRefs: [] },
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot read continuity", system: "memory-continuity" }],
      { host_tool_unavailable: true },
    );
  }

  if (!deps.state) {
    return makeEnvelope(
      "continuity.read",
      false,
      { status: "unavailable", unavailableReason: "state_store_unavailable", sourceRefs: [] },
      deps.surfaceMode,
      [],
      [{ code: "state_store_unavailable", message: "State DB not wired", system: "storage" }],
      { state_store_unavailable: true },
    );
  }

  try {
    // Use v9 state stores to read continuity card
    const latest = await readLatestSelfContinuityCard(deps.state);

    if (latest.degraded) {
      return makeEnvelope(
        "continuity.read",
        false,
        { status: "unavailable", unavailableReason: latest.degraded.reason, sourceRefs: [] },
        deps.surfaceMode,
        [],
        [{ code: latest.degraded.reason, message: latest.degraded.operatorNextAction, system: "memory-continuity" }],
      );
    }

    if (!latest.row || latest.row.status !== "active") {
      return makeEnvelope(
        "continuity.read",
        true,
        { status: "unavailable", unavailableReason: "continuity_unavailable", sourceRefs: [] },
        deps.surfaceMode,
        [],
        [{ code: "continuity_unavailable", message: "No active continuity card", system: "memory-continuity" }],
      );
    }

    // Parse card from row
    const sections = JSON.parse(latest.row.sectionsJson);
    const card: SelfContinuityCard = {
      id: latest.row.id,
      summary: sections.summary,
      bodyIntuition: sections.bodyIntuition,
      relationshipPosture: sections.relationshipPosture,
      valuePosture: sections.valuePosture,
      behaviorHabits: sections.behaviorHabits,
      activeRoutinePointers: sections.activeRoutinePointers,
      currentProhibitions: sections.currentProhibitions,
      characterFramePointer: JSON.parse(latest.row.characterFramePointerJson),
      sourceRefs: JSON.parse(latest.row.sourceRefsJson),
      acceptedAt: latest.row.createdAt,
      status: latest.row.status as SelfContinuityCard["status"],
      redactionClass: (latest.row.redactionClass as SelfContinuityCard["redactionClass"]) ?? "none",
    };

    const sourceRefs = card.sourceRefs ?? [];
    const evidenceLevel = promoteEvidenceLevel(
      defaultEvidenceLevel(deps.surfaceMode),
      sourceRefs.length > 0,
      false,
      false,
    );

    return makeEnvelope(
      "continuity.read",
      true,
      { status: "available", card, sourceRefs },
      deps.surfaceMode,
      sourceRefs,
      [],
      {},
      evidenceLevel,
      now(),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeEnvelope(
      "continuity.read",
      false,
      { status: "unavailable", unavailableReason: "continuity_read_exception", sourceRefs: [] },
      deps.surfaceMode,
      [],
      [{ code: "continuity_read_exception", message: msg, system: "memory-continuity" }],
    );
  }
}

// ───────────────────────────────────────────────────────────────
// Command: routine.list
// ───────────────────────────────────────────────────────────────

export async function handleRoutineList(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; status?: ("installed" | "disabled" | "rollback")[]; capabilityPattern?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<RoutineReadModel[]>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "routine.list",
      false,
      [],
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot list routines", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  if (!deps.state) {
    return makeEnvelope(
      "routine.list",
      false,
      [],
      deps.surfaceMode,
      [],
      [{ code: "state_store_unavailable", message: "State DB not wired", system: "storage" }],
      { state_store_unavailable: true },
    );
  }

  try {
    const statuses = input?.status ?? ["installed"];
    const registryStatuses: ToolRoutine["status"][] = statuses.flatMap((s) => {
      if (s === "installed") return ["active"];
      if (s === "disabled") return ["candidate", "validated"];
      if (s === "rollback") return ["retired"];
      return [];
    });

    const all: ToolRoutineRecord[] = [];
    for (const st of registryStatuses) {
      const { rows, degraded } = await readToolRoutinesByStatus(deps.state, st as ToolRoutineRecord["status"]);
      if (degraded) {
        return makeEnvelope(
          "routine.list",
          false,
          [],
          deps.surfaceMode,
          [],
          [{ code: degraded.reason, message: degraded.operatorNextAction, system: "storage" }],
          { state_store_unavailable: true },
        );
      }
      if (input?.capabilityPattern) {
        all.push(...rows.filter((r) => r.capabilityPattern === input.capabilityPattern));
      } else {
        all.push(...rows);
      }
    }

    const routines: RoutineReadModel[] = all.map((r) => routineRecordToReadModel(r));
    const sourceRefs = routines.flatMap((r) => r.sourceRefs);
    const evidenceLevel = promoteEvidenceLevel(
      defaultEvidenceLevel(deps.surfaceMode),
      sourceRefs.length > 0,
      false,
      false,
    );

    return makeEnvelope("routine.list", true, routines, deps.surfaceMode, sourceRefs, [], {}, evidenceLevel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeEnvelope(
      "routine.list",
      false,
      [],
      deps.surfaceMode,
      [],
      [{ code: "routine_list_exception", message: msg, system: "body-connector" }],
    );
  }
}

// ───────────────────────────────────────────────────────────────
// Command: routine.show
// ───────────────────────────────────────────────────────────────

export async function handleRoutineShow(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; routineId?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<RoutineReadModel | null>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "routine.show",
      false,
      null,
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot show routines", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  const routineId = input?.routineId;
  if (!routineId) {
    return makeEnvelope(
      "routine.show",
      false,
      null,
      deps.surfaceMode,
      [],
      [{ code: "routine_id_missing", message: "routineId is required" }],
    );
  }

  if (!deps.state) {
    return makeEnvelope(
      "routine.show",
      false,
      null,
      deps.surfaceMode,
      [],
      [{ code: "state_store_unavailable", message: "State DB not wired", system: "storage" }],
      { state_store_unavailable: true },
    );
  }

  try {
    const row = await readToolRoutineById(deps.state, routineId);
    if (!row) {
      return makeEnvelope(
        "routine.show",
        false,
        null,
        deps.surfaceMode,
        [],
        [{ code: "routine_not_found", message: `Routine ${routineId} not found` }],
      );
    }

    const routine = routineRecordToReadModel(row);
    return makeEnvelope(
      "routine.show",
      true,
      routine,
      deps.surfaceMode,
      routine.sourceRefs,
      [],
      {},
      promoteEvidenceLevel(defaultEvidenceLevel(deps.surfaceMode), routine.sourceRefs.length > 0, false, false),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeEnvelope(
      "routine.show",
      false,
      null,
      deps.surfaceMode,
      [],
      [{ code: "routine_show_exception", message: msg, system: "body-connector" }],
    );
  }
}

// ───────────────────────────────────────────────────────────────
// Command: routine.rollback (stub — delegates to body-connector T6.3.x)
// ───────────────────────────────────────────────────────────────

export async function handleRoutineRollback(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; routineId?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<{ rolledBack: boolean; rollbackRef?: string }>> {
  // Full implementation requires body-connector rollback port wiring (T6.3.x).
  // This handler validates input and returns a structured envelope.
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "routine.rollback",
      false,
      { rolledBack: false },
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot rollback routines", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  const routineId = input?.routineId;
  if (!routineId) {
    return makeEnvelope(
      "routine.rollback",
      false,
      { rolledBack: false },
      deps.surfaceMode,
      [],
      [{ code: "routine_id_missing", message: "routineId is required" }],
    );
  }

  // Delegate to body-connector rollback port — not yet wired in this wave.
  return makeEnvelope(
    "routine.rollback",
    false,
    { rolledBack: false },
    deps.surfaceMode,
    [],
    [{ code: "rollback_port_not_wired", message: "Routine rollback port not yet wired (T6.3.x pending)", system: "body-connector" }],
  );
}

// ───────────────────────────────────────────────────────────────
// Command: connector_evolution.status
// ───────────────────────────────────────────────────────────────

export async function handleConnectorEvolutionStatus(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; platformId?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<ConnectorEvolutionStatusReadModel[]>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "connector_evolution.status",
      false,
      [],
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot read evolution status", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  if (!deps.state) {
    return makeEnvelope(
      "connector_evolution.status",
      false,
      [],
      deps.surfaceMode,
      [],
      [{ code: "state_store_unavailable", message: "State DB not wired", system: "storage" }],
      { state_store_unavailable: true },
    );
  }

  try {
    let rows: ConnectorEvolutionPlanRecord[];
    if (input?.platformId) {
      const result = await readConnectorEvolutionPlansByPlatform(deps.state, input.platformId);
      if (result.degraded) {
        return makeEnvelope(
          "connector_evolution.status",
          false,
          [],
          deps.surfaceMode,
          [],
          [{ code: result.degraded.reason, message: result.degraded.operatorNextAction, system: "storage" }],
          { state_store_unavailable: true },
        );
      }
      rows = result.rows;
    } else {
      // Read all statuses
      const allStatuses: ConnectorEvolutionStatus[] = ["proposed", "gating", "activated", "rolled_back", "blocked"];
      rows = [];
      for (const st of allStatuses) {
        const result = await readConnectorEvolutionPlansByStatus(deps.state, st);
        if (result.degraded) {
          return makeEnvelope(
            "connector_evolution.status",
            false,
            [],
            deps.surfaceMode,
            [],
            [{ code: result.degraded.reason, message: result.degraded.operatorNextAction, system: "storage" }],
            { state_store_unavailable: true },
          );
        }
        rows.push(...result.rows);
      }
    }

    const plans: ConnectorEvolutionStatusReadModel[] = rows.map((r) => planRecordToReadModel(r));
    const sourceRefs = plans.flatMap((p) => p.sourceRefs);
    const evidenceLevel = promoteEvidenceLevel(
      defaultEvidenceLevel(deps.surfaceMode),
      sourceRefs.length > 0,
      false,
      false,
    );

    return makeEnvelope("connector_evolution.status", true, plans, deps.surfaceMode, sourceRefs, [], {}, evidenceLevel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeEnvelope(
      "connector_evolution.status",
      false,
      [],
      deps.surfaceMode,
      [],
      [{ code: "evolution_status_exception", message: msg, system: "body-connector" }],
    );
  }
}

// ───────────────────────────────────────────────────────────────
// Command: connector_evolution.trigger (stub — delegates to T6.3.1)
// ───────────────────────────────────────────────────────────────

export async function handleConnectorEvolutionTrigger(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; planId?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<{ triggered: boolean; planId?: string }>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "connector_evolution.trigger",
      false,
      { triggered: false },
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot trigger evolution", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  const planId = input?.planId;
  if (!planId) {
    return makeEnvelope(
      "connector_evolution.trigger",
      false,
      { triggered: false },
      deps.surfaceMode,
      [],
      [{ code: "plan_id_missing", message: "planId is required" }],
    );
  }

  // Delegate to connector evolution engine — not yet wired in this wave.
  return makeEnvelope(
    "connector_evolution.trigger",
    false,
    { triggered: false, planId },
    deps.surfaceMode,
    [],
    [{ code: "evolution_engine_not_wired", message: "Evolution trigger port not yet wired (T6.3.1 pending integration)", system: "body-connector" }],
  );
}

// ───────────────────────────────────────────────────────────────
// Command: connector_evolution.rollback (stub — delegates to T6.3.2)
// ───────────────────────────────────────────────────────────────

export async function handleConnectorEvolutionRollback(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string; planId?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<{ rolledBack: boolean; planId?: string }>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "connector_evolution.rollback",
      false,
      { rolledBack: false },
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot rollback evolution", system: "body-connector" }],
      { host_tool_unavailable: true },
    );
  }

  const planId = input?.planId;
  if (!planId) {
    return makeEnvelope(
      "connector_evolution.rollback",
      false,
      { rolledBack: false },
      deps.surfaceMode,
      [],
      [{ code: "plan_id_missing", message: "planId is required" }],
    );
  }

  // Delegate to connector rollback engine — not yet wired in this wave.
  return makeEnvelope(
    "connector_evolution.rollback",
    false,
    { rolledBack: false, planId },
    deps.surfaceMode,
    [],
    [{ code: "rollback_port_not_wired", message: "Evolution rollback port not yet wired (T6.3.2 pending integration)", system: "body-connector" }],
  );
}

// ───────────────────────────────────────────────────────────────
// Command: loop_status.read (v9 — with activity health)
// ───────────────────────────────────────────────────────────────

export async function handleLoopStatusRead(
  deps: V9OpsHandlerDeps,
  input: { workspaceRoot?: string } | undefined,
): Promise<RuntimeOpsEnvelopeV9<LoopStatusResult>> {
  if (deps.surfaceMode === "carrier") {
    return makeEnvelope(
      "loop_status.read",
      false,
      {} as LoopStatusResult,
      "carrier",
      [],
      [{ code: "host_tool_unavailable", message: "Carrier mode cannot read loop status", system: "observability" }],
      { host_tool_unavailable: true },
    );
  }

  if (!deps.loopStatusInputsProvider) {
    return makeEnvelope(
      "loop_status.read",
      false,
      {} as LoopStatusResult,
      deps.surfaceMode,
      [],
      [{ code: "loop_status_inputs_not_wired", message: "Loop status inputs provider not wired", system: "observability" }],
    );
  }

  try {
    const inputs = await deps.loopStatusInputsProvider();
    const loopStatus = aggregateLoopStatus(inputs, { currentCycleSequence: 0, windowHours: 24 });

    const sourceRefs = loopStatus.loop.reasons.length > 0
      ? [{ family: "ledger" as const, id: "loop_status" }]
      : [];
    const evidenceLevel = promoteEvidenceLevel(
      defaultEvidenceLevel(deps.surfaceMode),
      sourceRefs.length > 0,
      false,
      false,
    );

    return makeEnvelope("loop_status.read", true, loopStatus, deps.surfaceMode, sourceRefs, [], {}, evidenceLevel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeEnvelope(
      "loop_status.read",
      false,
      {} as LoopStatusResult,
      deps.surfaceMode,
      [],
      [{ code: "loop_status_exception", message: msg, system: "observability" }],
    );
  }
}

// ───────────────────────────────────────────────────────────────
// Master dispatch
// ───────────────────────────────────────────────────────────────

export async function dispatchV9OpsCommand(
  deps: V9OpsHandlerDeps,
  command: string,
  input: Record<string, unknown> | undefined,
): Promise<RuntimeOpsEnvelopeV9> {
  switch (command) {
    case "continuity.read":
      return handleContinuityRead(deps, input as { workspaceRoot?: string });
    case "routine.list":
      return handleRoutineList(deps, input as { workspaceRoot?: string; status?: ("installed" | "disabled" | "rollback")[]; capabilityPattern?: string });
    case "routine.show":
      return handleRoutineShow(deps, input as { workspaceRoot?: string; routineId?: string });
    case "routine.rollback":
      return handleRoutineRollback(deps, input as { workspaceRoot?: string; routineId?: string });
    case "connector_evolution.status":
      return handleConnectorEvolutionStatus(deps, input as { workspaceRoot?: string; platformId?: string });
    case "connector_evolution.trigger":
      return handleConnectorEvolutionTrigger(deps, input as { workspaceRoot?: string; planId?: string });
    case "connector_evolution.rollback":
      return handleConnectorEvolutionRollback(deps, input as { workspaceRoot?: string; planId?: string });
    case "loop_status.read":
      return handleLoopStatusRead(deps, input as { workspaceRoot?: string });
    default:
      return makeEnvelope(
        command,
        false,
        null,
        deps.surfaceMode,
        [],
        [{ code: "unknown_command", message: `Unknown v9 ops command: ${command}` }],
      );
  }
}

// ───────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────

function routineRecordToReadModel(r: ToolRoutineRecord): RoutineReadModel {
  const sourceRefs: SourceRef[] = JSON.parse(r.sourceRefsJson ?? "[]");
  return {
    routineId: r.id,
    capabilityRef: r.capabilityPattern,
    version: r.version,
    status: mapRoutineStatus(r.status as ToolRoutine["status"]),
    installedAt: r.createdAt,
    rollbackRef: r.rollbackRef ? { family: "routine", id: r.rollbackRef } : { family: "routine", id: "none" },
    sourceRefs,
  };
}

function mapRoutineStatus(status: ToolRoutine["status"]): RoutineReadModel["status"] {
  if (status === "active") return "installed";
  if (status === "retired") return "rollback";
  return "disabled";
}

function planRecordToReadModel(r: ConnectorEvolutionPlanRecord): ConnectorEvolutionStatusReadModel {
  const gateResults: GateResult[] = r.gateResultsJson ? JSON.parse(r.gateResultsJson) : [];
  const sourceRefs: SourceRef[] = r.sourceRefsJson ? JSON.parse(r.sourceRefsJson) : [];
  return {
    planId: r.id,
    platformId: r.platformId,
    targetVersion: r.id,
    previousStableRef: r.previousStableRef ? { family: "connector", id: r.previousStableRef } : undefined,
    gateResults,
    status: r.status as ConnectorEvolutionStatus,
    rollbackRef: r.rollbackCommandHint ? { family: "connector", id: r.rollbackCommandHint } : undefined,
    sourceRefs,
  };
}
