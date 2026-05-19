/**
 * Candidate intent planner (T2.1.3): window-biased planning + priority cap.
 * `planCandidateIntents` is the contract name; `planIntent` bridges legacy continuity-only tests.
 */
import type {
  CandidateIntent,
  ContinuitySnapshot,
  ControlPlaneSourceRef,
  DecisionBasis,
  IntentKind,
} from "../types.js";
import type { HeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import { isLifeEvidenceSliceEmpty } from "../heartbeat/runtime-snapshot.js";
import type { SnapshotInputs } from "../heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../heartbeat/runtime-snapshot.js";
import type { CapabilityContractRegistry } from "../../../connectors/base/manifest.js";
import type { NarrativeState } from "../../../storage/narrative/narrative-state-store.js";
import type { RelationshipMemory } from "../../../storage/relationship/relationship-memory-store.js";
import {
  resolvePlatformForIntent,
  type PlatformResolutionContext,
} from "./platform-capability-router.js";
import { isGoalRelatedToCandidate } from "./goal-priority.js";
import type { AgentGoal } from "../../../storage/goal/agent-goal-store.js";

const MAX_CANDIDATE_INTENTS = 6;

const OBLIGATION_SOURCE: ControlPlaneSourceRef[] = [
  { id: "obligation-anchor", kind: "workspace_artifact", uri: "workspace://obligations/pending" },
];

function evidenceRefsForConnector(runtime: HeartbeatRuntimeSnapshot): ControlPlaneSourceRef[] {
  if (!isLifeEvidenceSliceEmpty(runtime.lifeEvidence) && runtime.lifeEvidence.evidenceRefs.length > 0) {
    return runtime.lifeEvidence.evidenceRefs.slice(0, 8);
  }
  return [];
}

function isAllowedKind(kind: IntentKind, runtime: HeartbeatRuntimeSnapshot): boolean {
  return runtime.rhythmWindow.allowedIntentKinds.includes(kind);
}

function focusMatchesKind(focus: string, kind: IntentKind): boolean {
  const lower = focus.toLowerCase();
  switch (kind) {
    case "work":
      return lower.includes("work") || lower.includes("obligation") || lower.includes("task");
    case "exploration":
      return lower.includes("explor") || lower.includes("opportunit") || lower.includes("scan") || lower.includes("discover");
    case "social":
      return lower.includes("social") || lower.includes("engage") || lower.includes("community");
    case "outreach":
      return lower.includes("outreach") || lower.includes("user") || lower.includes("proactive") || lower.includes("contact");
    case "quiet":
      return lower.includes("quiet") || lower.includes("bookkeep") || lower.includes("pause");
    case "reflection":
      return lower.includes("reflect") || lower.includes("narrative") || lower.includes("review");
    case "maintenance":
      return lower.includes("maintenance") || lower.includes("check") || lower.includes("upkeep");
    default:
      return false;
  }
}

function planWorkIntents(
  runtime: HeartbeatRuntimeSnapshot,
  context?: PlatformResolutionContext,
  registry?: CapabilityContractRegistry,
): CandidateIntent[] {
  if (!isAllowedKind("work", runtime)) return [];
  const platformId = resolvePlatformForIntent("work", context ?? {}, registry);
  return runtime.continuity.pendingObligations.map((obligation, index) => ({
    id: platformId ? `intent-obligation-${platformId}-${index}` : `intent-obligation-${index}`,
    kind: "work" as const,
    priority: 100 - index,
    source: "obligation" as const,
    platformId,
    summary: platformId
      ? `fulfill obligation on ${platformId}: ${obligation}`
      : `fulfill obligation: ${obligation}`,
    effectClass: "connector_action" as const,
    sourceRefs: [...OBLIGATION_SOURCE],
    idempotencyKey: platformId
      ? `obligation:${platformId}:${obligation}:${index}`
      : `obligation:${obligation}:${index}`,
    goalInfluenceRefs: [],
  }));
}

function planExplorationIntents(
  runtime: HeartbeatRuntimeSnapshot,
  context?: PlatformResolutionContext,
  registry?: CapabilityContractRegistry,
): CandidateIntent[] {
  if (!isAllowedKind("exploration", runtime)) return [];
  const refs = evidenceRefsForConnector(runtime);
  const platformId = resolvePlatformForIntent("exploration", context ?? {}, registry);
  return [
    {
      id: platformId ? `intent-exploration-${platformId}` : "intent-exploration",
      kind: "exploration",
      priority: 70,
      source: "tick",
      platformId,
      summary: platformId
        ? `scan platform opportunities on ${platformId}`
        : "scan platform opportunities",
      effectClass: "connector_action",
      sourceRefs: refs,
      idempotencyKey: platformId
        ? `exploration:${platformId}`
        : "exploration:scan platform opportunities",
      goalInfluenceRefs: [],
    },
  ];
}

function planSocialIntents(
  runtime: HeartbeatRuntimeSnapshot,
  context?: PlatformResolutionContext,
  registry?: CapabilityContractRegistry,
  narrativeState?: NarrativeState,
): CandidateIntent[] {
  if (!isAllowedKind("social", runtime)) return [];
  const refs = evidenceRefsForConnector(runtime);
  const platformId = resolvePlatformForIntent("social", context ?? {}, registry);
  let priority = runtime.continuity.budgets && runtime.continuity.budgets.socialUsed >= runtime.continuity.budgets.socialLimit ? 10 : 60;
  if (narrativeState?.focus && focusMatchesKind(narrativeState.focus, "social")) {
    priority += 15;
  }
  return [
    {
      id: platformId ? `intent-social-${platformId}` : "intent-social",
      kind: "social",
      priority,
      source: "tick",
      platformId,
      summary: platformId
        ? `engage social platforms on ${platformId}`
        : "engage social platforms",
      effectClass: "connector_action",
      sourceRefs: refs,
      idempotencyKey: platformId
        ? `social:${platformId}`
        : "social:engage social platforms",
      goalInfluenceRefs: [],
    },
  ];
}

function planQuietReflectionIntents(
  runtime: HeartbeatRuntimeSnapshot,
  _context?: PlatformResolutionContext,
  _registry?: CapabilityContractRegistry,
): CandidateIntent[] {
  if (!runtime.rhythmWindow.quietBias && runtime.continuity.mode !== "quiet") {
    return [];
  }
  const out: CandidateIntent[] = [];
  if (isAllowedKind("quiet", runtime)) {
    out.push({
      id: "intent-quiet",
      kind: "quiet",
      priority: 55,
      source: "quiet_plan",
      summary: "quiet window bookkeeping",
      effectClass: "no_effect",
      sourceRefs: [],
      idempotencyKey: "quiet:bookkeeping",
      goalInfluenceRefs: [],
    });
  }
  if (isAllowedKind("maintenance", runtime)) {
    out.push({
      id: "intent-maintenance",
      kind: "maintenance",
      priority: 50,
      source: "quiet_plan",
      summary: "run maintenance checks",
      effectClass: "maintenance",
      sourceRefs: [],
      idempotencyKey: "maintenance:checks",
      goalInfluenceRefs: [],
    });
  }
  if (isAllowedKind("reflection", runtime)) {
    const refs = evidenceRefsForConnector(runtime);
    out.push({
      id: "intent-reflection",
      kind: "reflection",
      priority: 45,
      source: "quiet_plan",
      summary: "run narrative reflection",
      effectClass: "narrative_reflection",
      sourceRefs: refs,
      idempotencyKey: "reflection:narrative",
      goalInfluenceRefs: [],
    });
  }
  return out;
}

function planOutreachIntents(
  runtime: HeartbeatRuntimeSnapshot,
  context?: PlatformResolutionContext,
  registry?: CapabilityContractRegistry,
  narrativeState?: NarrativeState,
  relationshipMemory?: RelationshipMemory,
): CandidateIntent[] {
  if (!isAllowedKind("outreach", runtime)) return [];
  if (runtime.continuity.recentOutreachHashes.length > 3) {
    return [];
  }
  // CR-02: if noReplyCount is high, suppress outreach to avoid spam.
  if (relationshipMemory && relationshipMemory.noReplyCount > 3) {
    return [];
  }
  const refs = evidenceRefsForConnector(runtime);
  const platformId = resolvePlatformForIntent("outreach", context ?? {}, registry);
  let priority = 40;
  if (narrativeState?.focus && focusMatchesKind(narrativeState.focus, "outreach")) {
    priority += 15;
  }
  return [
    {
      id: platformId ? `intent-outreach-${platformId}` : "intent-outreach",
      kind: "outreach",
      priority,
      source: "tick",
      platformId,
      summary: platformId
        ? `consider proactive user outreach on ${platformId}`
        : "consider proactive user outreach",
      effectClass: "user_outreach",
      sourceRefs: refs,
      idempotencyKey: platformId
        ? `outreach:${platformId}`
        : "outreach:consider proactive user outreach",
      goalInfluenceRefs: [],
    },
  ];
}

export interface PlanCandidateIntentsOptions {
  /** T2.4.1: accepted goals for platform-specific resolution. */
  acceptedGoals?: import("../../../storage/goal/agent-goal-store.js").AgentGoal[];
  /** T2.4.1: optional connector registry for capability validation. */
  connectorRegistry?: CapabilityContractRegistry;
  /** CR-02: optional narrative state to influence candidate priority. */
  narrativeState?: NarrativeState;
  /** CR-02: optional relationship memory to influence outreach timing. */
  relationshipMemory?: RelationshipMemory;
}

/**
 * Plan ordered candidates for one heartbeat turn using rhythm window + life evidence slice.
 */
export function planCandidateIntents(
  runtime: HeartbeatRuntimeSnapshot,
  options?: PlanCandidateIntentsOptions,
): CandidateIntent[] {
  const context: PlatformResolutionContext = {
    acceptedGoals: options?.acceptedGoals,
    evidenceRefs: runtime.lifeEvidence.evidenceRefs,
  };
  const registry = options?.connectorRegistry;
  const narrativeState = options?.narrativeState ?? runtime.narrativeState;
  const relationshipMemory = options?.relationshipMemory ?? runtime.relationshipMemory;

  if (runtime.continuity.mode === "paused_for_interrupt") {
    const pausedMaintenance: CandidateIntent[] = [
      {
        id: "intent-maintenance",
        kind: "maintenance",
        priority: 40,
        source: "tick",
        summary: "run maintenance checks",
        effectClass: "maintenance",
        sourceRefs: [],
        idempotencyKey: "maintenance:checks",
        goalInfluenceRefs: [],
      },
    ];
    return pausedMaintenance
      .filter((intent) => runtime.rhythmWindow.allowedIntentKinds.includes(intent.kind))
      .slice(0, MAX_CANDIDATE_INTENTS);
  }

  if (runtime.continuity.mode === "maintenance_only") {
    return planWorkIntents(runtime, context, registry).sort((a, b) => b.priority - a.priority).slice(0, MAX_CANDIDATE_INTENTS);
  }

  const intents: CandidateIntent[] = [
    ...planWorkIntents(runtime, context, registry),
    ...planExplorationIntents(runtime, context, registry),
    ...planSocialIntents(runtime, context, registry, narrativeState),
    ...planQuietReflectionIntents(runtime, context, registry),
    ...planOutreachIntents(runtime, context, registry, narrativeState, relationshipMemory),
  ];

  // Pre-fill goalInfluenceRefs for non-obligation intents before returning.
  // applyGoalPriority will later refine/override with the same logic.
  const acceptedGoals = options?.acceptedGoals?.filter(
    (g) =>
      g.status === "accepted" &&
      (g.origin !== "agent_proposed" || g.acceptedBy === "policy_allowlist"),
  ) ?? [];

  for (const intent of intents) {
    if (intent.source === "obligation") continue;
    const related = acceptedGoals.filter((g) => isGoalRelatedToCandidate(g, intent));
    if (related.length > 0) {
      intent.goalInfluenceRefs = related.map((g) => g.goalId);
    }
  }

  // CR-02: apply narrative-focus bias globally across all candidate kinds.
  const adjusted = intents.map((intent) => {
    let priority = intent.priority;
    if (narrativeState?.focus && focusMatchesKind(narrativeState.focus, intent.kind)) {
      priority += 15;
    }
    return { ...intent, priority };
  });

  return adjusted
    .filter((intent) => runtime.rhythmWindow.allowedIntentKinds.includes(intent.kind))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_CANDIDATE_INTENTS);
}

/** @deprecated Continuity-only helper for tests; prefer `planCandidateIntents` + `buildHeartbeatRuntimeSnapshot`. */
export function planIntent(snapshot: ContinuitySnapshot): CandidateIntent[] {
  const inputs: SnapshotInputs = {
    mode: snapshot.mode,
    currentWindowId: snapshot.currentWindowId,
    pendingObligations: snapshot.pendingObligations,
    recentOutreachHashes: snapshot.recentOutreachHashes,
    deniedIntents: snapshot.deniedIntents,
    budgets: snapshot.budgets,
    awaitingUserInput: snapshot.awaitingUserInput,
    riskSuppressed: snapshot.riskSuppressed,
    quietEnabledBridge: snapshot.mode === "quiet",
  };
  const runtime = buildHeartbeatRuntimeSnapshot("2026-03-25T12:00:00.000Z", inputs, snapshot);
  return planCandidateIntents(runtime);
}

export function decideDecisionBasis(intent: CandidateIntent): DecisionBasis {
  if (intent.source === "obligation") return "rule_only";
  if (intent.effectClass === "maintenance" || intent.effectClass === "no_effect") return "rule_only";
  if (intent.kind === "outreach" || intent.kind === "reflection") return "model_assisted";
  if (intent.kind === "exploration" || intent.kind === "social" || intent.kind === "work") return "score_based";
  return "rule_only";
}
