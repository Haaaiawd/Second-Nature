/**
 * v9 Loop Health Aggregator (T8.2.1).
 *
 * Aggregates stage events, cycle traces, activity thread states, card results,
 * routine registry, connector evolution results, and character events into a
 * `LoopHealth` read model.
 *
 * Core logic:
 * - `aggregateLoopHealth`: classify stage events → stageAttribution + overall
 * - `aggregateActivityThreadHealth`: stale/overlong/missing-closure/blocked
 * - `aggregateContinuityHealth`: card available/stale/missing + projection counts
 * - `aggregateRoutineHealth`: installed/pending/denied + rollbackReady
 * - `aggregateConnectorEvolutionHealth`: gate summary + canary + rollback
 * - `aggregateCharacterFrameHealth`: deferred/conflict/accepted/rejected
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §3.3-§3.6 §4.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.md §5.1`
 * - ADR-004, ADR-006
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (LoopHealth, ContinuityHealth, etc.)
 *
 * Boundary:
 * - Pure functions; no DB access, no filesystem, no network.
 * - All inputs are injected as snapshots/queries.
 * - Character health output must not contain emotion/personality/identity-lock text.
 *
 * Test coverage: `tests/unit/observability/v9-loop-health.test.ts`
 */

import type {
  LoopHealth,
  LoopStageKind,
  StageEventStatus,
  HealthOverall,
  ContinuityHealth,
  RoutineHealth,
  ConnectorEvolutionHealth,
  CharacterFrameEventKind,
  SourceRef,
} from "../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Config constants (§1.8)
// ───────────────────────────────────────────────────────────────

export const PERF = {
  LOOP_STATUS_MAX_WINDOW_HOURS: 48,
  ACTIVITY_THREAD_STALE_HEARTBEATS: 6,
  ACTIVITY_THREAD_MAX_STEPS: 8,
} as const;

export const LOOP_STAGE_KINDS: LoopStageKind[] = [
  "evidence",
  "perception",
  "attention",
  "activity",
  "proposal",
  "policy",
  "dispatch",
  "closure",
  "quiet",
  "dream",
  "continuity",
  "connector_evolution",
  "rollback",
];

// ───────────────────────────────────────────────────────────────
// Input types
// ───────────────────────────────────────────────────────────────

export interface StageEventInput {
  stageKind: string;
  status: string;
  reasonCode: string;
}

export interface CycleTraceInput {
  closedAt: string | null;
}

export interface ActivityThreadSnapshot {
  threadId: string;
  threadStatus: "active" | "paused" | "completed" | "abandoned" | "blocked";
  completedStepCount: number;
  lastHeartbeatSequence: number;
  lastStepKind?: string;
  closureLinked: boolean;
  sourceRefs: SourceRef[];
}

export interface ActivityThreadHealthOutput {
  threadId: string;
  threadStatus: ActivityThreadSnapshot["threadStatus"];
  status: HealthOverall;
  reasonCode: string | null;
  completedStepCount: number;
  lastHeartbeatSequence: number;
  closureLinked: boolean;
  sourceRefs: SourceRef[];
}

export interface SelfContinuityCardAssemblyResultInput {
  kind: "ok" | "unavailable";
  reasonCode?: string;
  isStale?: boolean;
  card?: { sourceRefs: SourceRef[] };
  projections?: { kind: "memory" | "procedural" }[];
}

export interface ToolRoutineRegistrySnapshotInput {
  routines: {
    routineId: string;
    capabilityPattern: string;
    version: string;
    status: "candidate" | "validated" | "active" | "retired";
    rollbackRef?: string;
    healthReason?: string;
    sourceRefs: SourceRef[];
  }[];
}

export interface ConnectorEvolutionResultInput {
  planId: string;
  platformId: string;
  gates: { name: string; result: "pass" | "fail" | "skipped" }[];
  canaryResult?: "pass" | "fail";
  rollbackAttempted?: boolean;
  rollbackSucceeded?: boolean;
  activeVersionRef?: string;
  previousStableRef?: string;
}

export interface CharacterFrameEventInput {
  frameId: string;
  eventKind: CharacterFrameEventKind;
  sourceRefCount: number;
}

// ───────────────────────────────────────────────────────────────
// aggregateLoopHealth (§3.3)
// ───────────────────────────────────────────────────────────────

export interface LoopHealthQuery {
  windowHours?: number;
  currentCycleSequence: number;
}

export interface LoopHealthInputs {
  stageEvents: StageEventInput[];
  cycleTraces: CycleTraceInput[];
  activityHealth: ActivityThreadHealthOutput[];
}

export function aggregateLoopHealth(
  inputs: LoopHealthInputs,
  query: LoopHealthQuery,
): LoopHealth {
  const windowHours = query.windowHours ?? PERF.LOOP_STATUS_MAX_WINDOW_HOURS;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const windowEnd = now.toISOString();

  // Initialize attribution: all stages start as 'empty'.
  const attribution: Record<string, StageEventStatus> = {};
  for (const kind of LOOP_STAGE_KINDS) {
    attribution[kind] = "empty";
  }

  const reasons: string[] = [];
  let rollbackBlocked = false;

  // Classify stage events.
  for (const event of inputs.stageEvents) {
    const current = attribution[event.stageKind] ?? "empty";
    if (event.status === "blocked") {
      attribution[event.stageKind] = "blocked";
      reasons.push(event.reasonCode);
      if (event.stageKind === "rollback") {
        rollbackBlocked = true;
      }
    } else if (event.status === "degraded" && current !== "blocked") {
      attribution[event.stageKind] = "degraded";
      reasons.push(event.reasonCode);
    } else if (event.status === "ok" && current === "empty") {
      attribution[event.stageKind] = "ok";
    } else if (event.status === "skipped" && current === "empty") {
      attribution[event.stageKind] = "skipped";
    }
  }

  // Check for missing closure traces.
  const missingClosureTraces = inputs.cycleTraces.filter((t) => !t.closedAt);
  if (missingClosureTraces.length > 0) {
    attribution["closure"] = "blocked";
    reasons.push("loop_degraded_missing_closure");
  }

  // Aggregate activity thread health.
  for (const activity of inputs.activityHealth) {
    if (activity.status === "blocked") {
      attribution["activity"] = "blocked";
      reasons.push(activity.reasonCode ?? "activity_thread_blocked");
    } else if (activity.status === "degraded" && attribution["activity"] !== "blocked") {
      attribution["activity"] = "degraded";
      reasons.push(activity.reasonCode ?? "activity_thread_stale");
    } else if (attribution["activity"] === "empty" && activity.status === "healthy") {
      attribution["activity"] = "ok";
    }
  }

  // Compute activity terminal counts.
  const activityTerminalCounts = {
    active: 0,
    paused: 0,
    completed: 0,
    abandoned: 0,
    blocked: 0,
  };
  for (const activity of inputs.activityHealth) {
    activityTerminalCounts[activity.threadStatus]++;
  }

  // Determine overall health.
  let overall: HealthOverall = "healthy";
  if (rollbackBlocked || Object.values(attribution).includes("blocked")) {
    overall = "blocked";
  } else if (Object.values(attribution).includes("degraded")) {
    overall = "degraded";
  }

  return {
    windowStart,
    windowEnd,
    overall,
    stageAttribution: attribution as Record<LoopStageKind, StageEventStatus>,
    activityTerminalCounts,
    reasons: [...new Set(reasons)],
    rollbackBlocked,
  };
}

// ───────────────────────────────────────────────────────────────
// aggregateActivityThreadHealth (§3.3a)
// ───────────────────────────────────────────────────────────────

export function aggregateActivityThreadHealth(
  snapshot: ActivityThreadSnapshot,
  currentCycleSequence: number,
): ActivityThreadHealthOutput {
  const stale =
    currentCycleSequence - snapshot.lastHeartbeatSequence > PERF.ACTIVITY_THREAD_STALE_HEARTBEATS;
  const overlong = snapshot.completedStepCount > PERF.ACTIVITY_THREAD_MAX_STEPS;
  const missingClosure =
    snapshot.lastStepKind === "propose_action" && !snapshot.closureLinked;

  if (snapshot.threadStatus === "blocked") {
    return toActivityHealth(snapshot, "blocked", "activity_thread_blocked");
  }
  if (overlong) {
    return toActivityHealth(snapshot, "blocked", "activity_thread_overlong");
  }
  if (missingClosure) {
    return toActivityHealth(snapshot, "blocked", "activity_thread_missing_closure");
  }
  if (stale && snapshot.threadStatus === "active") {
    return toActivityHealth(snapshot, "degraded", "activity_thread_stale");
  }
  return toActivityHealth(snapshot, "healthy", null);
}

function toActivityHealth(
  snapshot: ActivityThreadSnapshot,
  status: HealthOverall,
  reasonCode: string | null,
): ActivityThreadHealthOutput {
  return {
    threadId: snapshot.threadId,
    threadStatus: snapshot.threadStatus,
    status,
    reasonCode,
    completedStepCount: snapshot.completedStepCount,
    lastHeartbeatSequence: snapshot.lastHeartbeatSequence,
    closureLinked: snapshot.closureLinked,
    sourceRefs: snapshot.sourceRefs,
  };
}

// ───────────────────────────────────────────────────────────────
// aggregateContinuityHealth (§3.4)
// ───────────────────────────────────────────────────────────────

export function aggregateContinuityHealth(
  cardResult: SelfContinuityCardAssemblyResultInput,
): ContinuityHealth {
  if (cardResult.kind === "unavailable") {
    return {
      cardAvailable: false,
      cardSourceRefCount: 0,
      unavailableReason: cardResult.reasonCode,
      projectionFreshness: "missing",
      memoryProjectionCount: 0,
      proceduralProjectionCount: 0,
    };
  }

  const memoryCount = (cardResult.projections ?? []).filter((p) => p.kind === "memory").length;
  const proceduralCount = (cardResult.projections ?? []).filter((p) => p.kind === "procedural").length;

  return {
    cardAvailable: true,
    cardSourceRefCount: cardResult.card?.sourceRefs.length ?? 0,
    projectionFreshness: cardResult.isStale ? "stale" : "fresh",
    memoryProjectionCount: memoryCount,
    proceduralProjectionCount: proceduralCount,
  };
}

// ───────────────────────────────────────────────────────────────
// aggregateRoutineHealth (§3.5)
// ───────────────────────────────────────────────────────────────

export function aggregateRoutineHealth(
  registrySnapshot: ToolRoutineRegistrySnapshotInput,
): RoutineHealth {
  const installed = registrySnapshot.routines.filter((r) => r.status === "active");
  const pending = registrySnapshot.routines.filter((r) => r.status === "validated");
  const denied = registrySnapshot.routines.filter(
    (r) => r.status === "candidate" && r.healthReason === "routine_permission_expansion_denied",
  );
  const rollbackReady = registrySnapshot.routines.every(
    (r) => r.status !== "active" || !!r.rollbackRef,
  );

  const reasons: string[] = [];
  if (pending.length > 0) {
    reasons.push("routine_validation_pending");
  }
  if (denied.length > 0) {
    reasons.push("routine_permission_expansion_denied");
  }

  return {
    installedCount: installed.length,
    pendingValidationCount: pending.length,
    deniedCount: denied.length,
    rollbackReady,
    reasons,
  };
}

// ───────────────────────────────────────────────────────────────
// aggregateConnectorEvolutionHealth (§3.6)
// ───────────────────────────────────────────────────────────────

export function aggregateConnectorEvolutionHealth(
  planResult: ConnectorEvolutionResultInput,
): ConnectorEvolutionHealth {
  const gateSummary: Record<string, "pass" | "fail" | "skipped"> = {};
  let blockedReason: string | undefined;

  for (const gate of planResult.gates) {
    gateSummary[gate.name] = gate.result;
    if (gate.result === "fail") {
      blockedReason = `evolution_gate_${gate.name}_failed`;
    }
  }

  let rollbackStatus: "not_needed" | "success" | "failed" = "not_needed";
  if (planResult.rollbackAttempted) {
    rollbackStatus = planResult.rollbackSucceeded ? "success" : "failed";
    if (rollbackStatus === "failed") {
      blockedReason = "evolution_rollback_failed";
    }
  }

  if (planResult.canaryResult === "fail") {
    blockedReason = "evolution_canary_failed";
  }

  return {
    activeVersionRef: planResult.activeVersionRef,
    previousStableRef: planResult.previousStableRef,
    gateSummary,
    canaryResult: planResult.canaryResult ?? "not_run",
    rollbackStatus,
    blockedReason,
  };
}

// ───────────────────────────────────────────────────────────────
// aggregateCharacterFrameHealth (§5.6 ADR-006)
// ───────────────────────────────────────────────────────────────

export interface CharacterFrameHealth {
  totalEvents: number;
  deferredCount: number;
  conflictCount: number;
  acceptedCount: number;
  rejectedCount: number;
  retiredCount: number;
  supersededCount: number;
  refreshedCount: number;
  /** True if any deferred/conflict events — health is degraded. */
  hasDeferredOrConflict: boolean;
  /** Safe observational text (no emotion/personality/identity-lock). */
  summary: string;
}

export function aggregateCharacterFrameHealth(
  events: CharacterFrameEventInput[],
): CharacterFrameHealth {
  const counts: Record<CharacterFrameEventKind, number> = {
    refresh: 0,
    accepted: 0,
    rejected: 0,
    revised: 0,
    retired: 0,
    superseded: 0,
    deferred: 0,
    conflict: 0,
  };

  for (const event of events) {
    counts[event.eventKind]++;
  }

  const hasDeferredOrConflict = counts.deferred > 0 || counts.conflict > 0;

  // Safe summary text — no emotion/personality/identity-lock/hard-control claims.
  const summary = `Character frame events: ${events.length} total, ` +
    `${counts.accepted} accepted, ${counts.rejected} rejected, ` +
    `${counts.deferred} deferred, ${counts.conflict} conflict. ` +
    `Source references across events.`;

  return {
    totalEvents: events.length,
    deferredCount: counts.deferred,
    conflictCount: counts.conflict,
    acceptedCount: counts.accepted,
    rejectedCount: counts.rejected,
    retiredCount: counts.retired,
    supersededCount: counts.superseded,
    refreshedCount: counts.refresh,
    hasDeferredOrConflict,
    summary,
  };
}

// ───────────────────────────────────────────────────────────────
// Composite loop status (combines all health dimensions)
// ───────────────────────────────────────────────────────────────

export interface LoopStatusResult {
  loop: LoopHealth;
  continuity: ContinuityHealth;
  routine: RoutineHealth;
  connectorEvolution: ConnectorEvolutionHealth;
  character: CharacterFrameHealth;
  /** Overall health across all dimensions. */
  overall: HealthOverall;
}

export interface LoopStatusInputs extends LoopHealthInputs {
  continuityCardResult: SelfContinuityCardAssemblyResultInput;
  routineRegistrySnapshot: ToolRoutineRegistrySnapshotInput;
  connectorEvolutionResult: ConnectorEvolutionResultInput;
  characterFrameEvents: CharacterFrameEventInput[];
}

export function aggregateLoopStatus(
  inputs: LoopStatusInputs,
  query: LoopHealthQuery,
): LoopStatusResult {
  const loop = aggregateLoopHealth(inputs, query);
  const continuity = aggregateContinuityHealth(inputs.continuityCardResult);
  const routine = aggregateRoutineHealth(inputs.routineRegistrySnapshot);
  const connectorEvolution = aggregateConnectorEvolutionHealth(inputs.connectorEvolutionResult);
  const character = aggregateCharacterFrameHealth(inputs.characterFrameEvents);

  // Determine overall across all dimensions.
  let overall: HealthOverall = loop.overall;
  if (connectorEvolution.blockedReason) {
    overall = "blocked";
  }
  if (character.hasDeferredOrConflict && overall === "healthy") {
    overall = "degraded";
  }
  if (!continuity.cardAvailable && overall === "healthy") {
    overall = "degraded";
  }
  if (routine.reasons.length > 0 && overall === "healthy") {
    overall = "degraded";
  }

  return {
    loop,
    continuity,
    routine,
    connectorEvolution,
    character,
    overall,
  };
}
