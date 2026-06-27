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
import type { DegradedOperationResult } from "./v8-contracts.js";
export type { DegradedOperationResult } from "./v8-contracts.js";
export interface IdentityProfile {
}
export interface AgentGoal {
}
export interface Interaction {
}
export interface ToolExperience {
}
export type SourceRefFamily = "evidence" | "attention" | "action" | "routine" | "character" | "dream" | "quiet" | "connector" | "capability_probe_result" | "ledger" | "activity";
export interface SourceRef {
    family: SourceRefFamily;
    id: string;
    label?: string;
}
export interface EvidenceIdentityPort {
    normalizeEvidenceIdentity(item: EvidenceItem): Promise<StableEvidenceIdentity>;
}
export interface StableEvidenceIdentity {
    logicalId: string;
    platformId: string;
    externalId?: string;
    contentHash: string;
    seenCount: number;
    firstObservedAt: string;
    lastObservedAt: string;
    repetitionStatus: RepetitionKind;
}
export type RepetitionKind = "new" | "changed" | "duplicate" | "identity_unstable";
export interface EvidenceItem {
    platformId: string;
    externalId?: string;
    contentHash?: string;
    observedAt: string;
    content?: string;
    sourceRefs?: SourceRef[];
}
export type AttentionActionKind = "notify_owner" | "watch" | "remember" | "defer";
export interface AttentionSignal {
    signalId: string;
    activityThreadId?: string;
    threadSuggestion?: "create" | "continue" | "pause" | "complete" | "none";
    novelty: number;
    relevance: number;
    repetition: RepetitionKind;
    risk: "none" | "low" | "medium" | "high";
    possibleActions: AttentionActionKind[];
    sourceRefs: SourceRef[];
    summary: string;
    status: "attentive" | "attention_blocked_missing_sources" | "degraded";
    reason?: string;
}
export interface AttentionSignalRow {
    signalId: string;
    activityThreadId?: string;
    novelty: number;
    repetition: "new" | "changed" | "duplicate" | "identity_unstable";
    status: "attentive" | "attention_blocked_missing_sources" | "degraded";
    sourceRefsJson: string;
    payloadJson: string;
}
export type ActivityThreadStatus = "active" | "paused" | "completed" | "abandoned" | "blocked";
export type ActivityStepKind = "observe" | "associate" | "ask_agent" | "propose_action" | "policy_closure" | "pause" | "complete";
export interface ActivityThread {
    threadId: string;
    originAttentionSignalId: string;
    status: ActivityThreadStatus;
    currentFocus: string;
    associations: string[];
    nextPossibleMoves: ActivityStepKind[];
    completedStepCount: number;
    lastStepKind?: ActivityStepKind;
    blockerReason?: string;
    stopCondition: "single_step_done" | "agent_paused" | "goal_satisfied" | "blocked" | "stale" | "max_steps";
    lastHeartbeatSequence: number;
    sourceRefs: SourceRef[];
    createdAt: string;
    updatedAt: string;
}
export interface ActivityStep {
    stepId: string;
    threadId: string;
    cycleId: string;
    stepKind: ActivityStepKind;
    summary: string;
    sourceRefs: SourceRef[];
    closureRef?: SourceRef;
    createdAt: string;
}
export interface SelfContinuityCard {
    id: string;
    summary: string;
    bodyIntuition: string;
    relationshipPosture: string;
    valuePosture: string;
    behaviorHabits: string[];
    activeRoutinePointers: RoutinePointer[];
    currentProhibitions: string[];
    characterFramePointer: CharacterFramePointer;
    sourceRefs: SourceRef[];
    acceptedAt: string;
    status: "active" | "deferred" | "unavailable";
    redactionClass?: "none" | "redacted" | "blocked";
}
export interface SelfContinuityCardSections {
    summary: string;
    bodyIntuition: string;
    relationshipPosture: string;
    valuePosture: string;
    behaviorHabits: string[];
    activeRoutinePointers: RoutinePointer[];
    currentProhibitions: string[];
}
export interface SelfContinuityCardRow {
    id: string;
    cardText: string;
    sectionsJson: string;
    sourceRefsJson: string;
    characterFramePointerJson: string;
    status: "active" | "deferred" | "unavailable";
    createdAt: string;
}
export interface ContinuityScope {
    workspaceRoot: string;
    now?: string;
    maxSummaryLength?: number;
}
export interface ContinuityReadPort {
    loadSelfContinuityCard(scope: ContinuityScope): Promise<SelfContinuityCard | DegradedOperationResult>;
    loadRoutineList(filters: {
        workspaceRoot: string;
        status?: ("installed" | "disabled" | "rollback")[];
        capabilityPattern?: string;
    }): Promise<{
        routines: RoutineListItem[];
        degraded?: DegradedOperationResult;
    }>;
    loadActiveMemoryProjections(filters: {
        workspaceRoot: string;
        now?: string;
    }): Promise<{
        projections: MemoryProjection[];
        degraded?: DegradedOperationResult;
    }>;
    loadActiveProceduralProjections(filters: {
        workspaceRoot: string;
        now?: string;
    }): Promise<{
        projections: ProceduralProjection[];
        degraded?: DegradedOperationResult;
    }>;
    loadActiveCharacterFramePointer(scope: ContinuityScope): Promise<{
        pointer?: CharacterFramePointer;
        degraded?: DegradedOperationResult;
    }>;
}
export interface RoutinePointer {
    routineId: string;
    capabilityPattern: string;
    version: string;
    sourceRefs: SourceRef[];
}
export type CharacterFrameStatus = "candidate" | "accepted" | "rejected" | "retired" | "superseded";
export interface CharacterFrame {
    id: string;
    projectionKind: "character_frame";
    version: number;
    status: CharacterFrameStatus;
    validFrom: string;
    validUntil: string | null;
    charCount: number;
    sourceRefs: SourceRef[];
    emergentHabits?: EmergentHabit[];
    valuePosture: ValuePosture | null;
    relationshipPosture: RelationshipPosture | null;
    expressionPosture: ExpressionPosture | null;
    growthTensions?: GrowthTension[];
    conflictNotes?: ConflictNote[];
    contestPrompt: string;
    supersededBy: string | null;
    revisionOf: string | null;
    createdAt: string;
    acceptedAt?: string;
    payloadJson?: string;
}
export interface EmergentHabit {
    description: string;
    sourceRefs: SourceRef[];
    confidence: "low" | "medium" | "high";
}
export interface ValuePosture {
    ordering: string[];
    note?: string;
    sourceRefs: SourceRef[];
}
export interface RelationshipPosture {
    toward: string;
    stance: string;
    sourceRefs: SourceRef[];
}
export interface ExpressionPosture {
    styleNotes: string[];
    boundaryConstraints?: string[];
    sourceRefs: SourceRef[];
}
export interface GrowthTension {
    tension: string;
    sourceRefs: SourceRef[];
}
export interface ConflictNote {
    note: string;
    conflictingSourceRefs: SourceRef[];
}
export interface CharacterFramePointer {
    frameId: string;
    summary: string;
    contestPrompt: string;
    sourceRefs: SourceRef[];
    status: "active" | "deferred" | "contested" | "superseded";
    newlyProposed?: boolean;
}
export type CharacterContestAction = "accept" | "reject" | "revise" | "retire";
export interface CharacterContestResult {
    frameId: string;
    previousStatus: CharacterFrameStatus;
    newStatus: CharacterFrameStatus;
    successorFrameId?: string;
    sourceRefs: SourceRef[];
}
export interface EmbodiedContextCharacterProjection {
    frameId: string;
    text: string;
    contestPrompt: string;
    sourceRefs: SourceRef[];
    status: "active" | "deferred" | "contested";
    newlyProposed?: boolean;
}
export interface CharacterRefreshInput {
    kind: "input";
    refreshId: string;
    workspaceRoot: string;
    locale: "zh-CN" | "en" | "mixed";
    trigger: "dream_consolidation" | "agent_revise" | "owner_feedback" | "manual_refresh";
    signals: CharacterSignal[];
    sourceRefs: SourceRef[];
    createdAt: string;
}
export interface CharacterSignal {
    signalId: string;
    signalKind: CharacterSignalKind;
    originSystem: CharacterSignalOriginSystem;
    summary: string;
    sourceRefs: SourceRef[];
    redactionClass: CharacterSignalRedactionClass;
    confidence: "low" | "medium" | "high";
    locale: "zh-CN" | "en" | "mixed";
}
export type CharacterSignalKind = "tool_experience" | "action_closure" | "owner_feedback" | "relationship_signal" | "expression_outcome" | "dream_projection" | "agent_contest";
export type CharacterSignalOriginSystem = "memory-continuity-system" | "body-connector-system" | "control-context-system" | "observability-recovery-system";
export type CharacterSignalRedactionClass = "none" | "redacted" | "private_blocked" | "credential_blocked" | "prompt_blocked";
export type RoutineRegistryStatus = "candidate" | "validated" | "active" | "retired";
export interface ToolRoutine {
    id: string;
    routineId: string;
    name: string;
    version: string;
    capabilityPattern: string;
    triggerCapabilities: string[];
    triggerConditionsJson: string;
    stepsJson: string;
    guardSchemaJson: string;
    rollbackRef: string;
    status: RoutineRegistryStatus;
    sourceRefs: SourceRef[];
    createdAt: string;
    activatedAt?: string;
    retiredAt?: string;
}
export interface RoutineListItem {
    routineId: string;
    capabilityPattern: string;
    status: "installed" | "disabled" | "rollback";
    version: string;
    sourceRefs: SourceRef[];
    rollbackRef?: SourceRef;
}
export interface ToolRoutineGuardSchema {
    version: "1.0.0";
    allowedCapabilities: string[];
    deniedCapabilities: string[];
    maxSideEffectClass: "none" | "owner_attention" | "external_write";
    requiresOwnerConfirm: boolean;
    maxStepCount: number;
    maxTimeoutMs: number;
    sandboxPolicy: "strict" | "declarative_only";
}
export type ConnectorPlanType = "manifest_delta" | "recipe_delta" | "adapter_delta";
export type ConnectorEvolutionStatus = "proposed" | "gating" | "activated" | "rolled_back" | "blocked";
export type ConnectorVersionStatus = "candidate" | "staged" | "active" | "rolled_back";
export interface ConnectorEvolutionPlan {
    id: string;
    platformId: string;
    planType: ConnectorPlanType;
    payloadJson: string;
    status: ConnectorEvolutionStatus;
    gateResults?: GateResult[];
    previousStableRef?: string;
    rollbackCommandHint?: string;
    sourceRefs: SourceRef[];
    createdAt: string;
}
export interface ConnectorVersion {
    id: string;
    versionId: string;
    platformId: string;
    workspaceRoot: string;
    planType: ConnectorPlanType;
    manifestPath: string;
    recipePath?: string;
    adapterPath?: string;
    declaredCapabilities: string[];
    gateResults: GateResult[];
    status: ConnectorVersionStatus;
    previousStableRef?: string;
    rollbackRef?: string;
    rollbackCommandHint?: string;
    sourceRefs: SourceRef[];
    createdAt: string;
    activatedAt?: string;
    rolledBackAt?: string;
}
export interface GateResult {
    gate: string;
    passed: boolean;
    reason?: string;
    evidenceRefs: SourceRef[];
}
export type AutonomousChangeKind = "routine_install" | "routine_supersede" | "routine_retire" | "connector_manifest_delta" | "connector_recipe_delta" | "connector_adapter_delta";
export type AutonomousChangeStatus = "proposed" | "gated" | "activated" | "rolled_back" | "blocked";
export interface AutonomousChangeLedgerEntry {
    id: string;
    workspaceRoot: string;
    changeKind: AutonomousChangeKind;
    targetId: string;
    previousStableRef?: string;
    status: AutonomousChangeStatus;
    gateResultsJson?: string;
    rollbackRef?: string;
    rollbackCommandHint?: string;
    sourceRefs: SourceRef[];
    redactedPayloadJson?: string;
    createdAt: string;
    activatedAt?: string;
    rolledBackAt?: string;
}
export interface AutonomousChangeLedgerWritePort {
    writeLedgerEntry(entry: AutonomousChangeLedgerEntry): Promise<void>;
}
export type ActionClosureActionKind = "no_action" | "remember" | "connector" | "guidance" | "routine";
export type ActionClosureDecision = "allow" | "defer" | "downgrade" | "deny";
export interface ActionClosureRecord {
    id: string;
    cycleSequence: number;
    intentId?: string;
    actionKind: ActionClosureActionKind;
    decision: ActionClosureDecision;
    platformId?: string;
    capabilityId?: string;
    sourceRefs: SourceRef[];
    proofRefs: SourceRef[];
    traceRefs: SourceRef[];
    closureRefs: SourceRef[];
    payloadJson?: string;
    reasonCode: string;
    routineInvocationId?: string;
    routineVersion?: string;
    activityThreadId?: string;
    activityStepId?: string;
    createdAt: string;
}
export interface ContextSlice<T> {
    status: "loaded" | "degraded" | "blocked";
    data: T;
    reason?: string;
}
export interface MemoryProjection {
    id: string;
    kind: "memory";
    sourceRefs: SourceRef[];
}
export interface ProceduralProjection {
    id: string;
    kind: "procedural";
    sourceRefs: SourceRef[];
}
export interface AffordanceMap {
}
export interface SelfHealthSnapshot {
}
export interface EmbodiedContext {
    identity: ContextSlice<IdentityProfile>;
    goals: ContextSlice<AgentGoal[]>;
    recentInteractions: ContextSlice<Interaction[]>;
    toolExperience: ContextSlice<ToolExperience[]>;
    acceptedDream: ContextSlice<MemoryProjection[]>;
    affordanceMap: ContextSlice<AffordanceMap>;
    selfHealth: ContextSlice<SelfHealthSnapshot>;
    selfContinuityCard: ContextSlice<SelfContinuityCard>;
    characterFramePointer: ContextSlice<CharacterFramePointer>;
    characterFrameProjection: ContextSlice<EmbodiedContextCharacterProjection>;
    activeMemoryProjections: ContextSlice<MemoryProjection[]>;
    activeProceduralProjections: ContextSlice<ProceduralProjection[]>;
    routineList: ContextSlice<RoutineListItem[]>;
    activityThreads: ContextSlice<ActivityThread[]>;
    attentionSignals?: ContextSlice<AttentionSignal[]>;
    assembledAt: string;
}
export type PlatformNeutralActionKind = "ignore" | "watch" | "remember" | "notify_owner" | "draft_reply" | "auto_reply" | "draft_publish" | "auto_publish" | "run_connector" | "routine";
export type ActionSideEffectClass = "none" | "local_state" | "owner_attention" | "external_write" | "external_read" | "capability_declared" | "routine";
export interface ActionKindMetadata {
    kind: PlatformNeutralActionKind;
    sideEffectClass: ActionSideEffectClass;
    allowedDowngrades: PlatformNeutralActionKind[];
}
export declare const V9_ACTION_KIND_REGISTRY: Readonly<Record<PlatformNeutralActionKind, ActionKindMetadata>>;
export interface AgentActionIntent {
    intentId: string;
    actionKind: PlatformNeutralActionKind;
    attentionSignalRefs: SourceRef[];
    sourceRefs: SourceRef[];
    targetPlatformId?: string;
    targetCapabilityId?: string;
    routineInvocation?: RoutineInvocation;
    payloadSummary?: string;
}
export interface AttentionSignalRef {
    signalId: string;
    selectedActionKind: AttentionActionKind;
    platformId?: string;
    capabilityId?: string;
    rationale: string;
    sourceRefs: SourceRef[];
}
export interface ToolRoutineReadModel {
    routineId: string;
    capabilityPattern: string;
    version: string;
    status: RoutineRegistryStatus;
    sourceRefs: SourceRef[];
    rollbackRef?: SourceRef;
}
export interface PolicyEvaluationContext {
    affordancePosture: AffordancePosture;
    platformPermissionDeclared: boolean;
    circuitBreakerClosed: boolean;
    ownerPreference: boolean;
    credentialHealth: "ok" | "missing" | "degraded";
}
export interface RoutineInvocation {
    routineId: string;
    version: string;
    capabilityPattern: string;
    payload: Record<string, unknown>;
    sourceRefs: SourceRef[];
}
export interface ActionProposal {
    id: string;
    cycleId: string;
    actionKind: PlatformNeutralActionKind;
    targetPlatformId?: string;
    targetCapabilityId?: string;
    sourceRefs: SourceRef[];
    proofRefs: SourceRef[];
    reason: V9ReasonCode;
    riskPosture: "low" | "medium" | "high" | "blocked";
    sideEffectClass: ActionSideEffectClass;
    idempotencyKey: string;
    routineInvocationId?: string;
    routineVersion?: string;
    createdAt: string;
}
export interface ActionPolicyDecision {
    id: string;
    proposalId: string;
    decision: "allow" | "defer" | "downgrade" | "deny";
    decisionReason: V9ReasonCode;
    autonomyLevel: "none" | "draft_only" | "owner_confirm" | "auto_allowed";
    downgradedActionKind?: PlatformNeutralActionKind;
    proofRefs: SourceRef[];
    decidedAt: string;
}
export interface RoutinePolicyEvaluationContext extends PolicyEvaluationContext {
    guard: ToolRoutineGuardSchema;
    routineSourceRefs: SourceRef[];
}
export type RoutineInvocationProposal = Omit<ActionProposal, "actionKind" | "sideEffectClass"> & {
    actionKind: "routine";
    sideEffectClass: "routine";
    routineInvocationId: string;
    routineVersion: string;
};
export type LoopStageKind = "evidence" | "perception" | "attention" | "activity" | "proposal" | "policy" | "dispatch" | "closure" | "quiet" | "dream" | "continuity" | "connector_evolution" | "rollback";
export type StageEventStatus = "ok" | "degraded" | "blocked" | "skipped" | "empty";
export type HealthOverall = "healthy" | "degraded" | "blocked";
export type CharacterFrameEventKind = "refresh" | "accepted" | "rejected" | "revised" | "retired" | "superseded" | "deferred" | "conflict";
export interface LoopStageEventRow {
    id: string;
    cycleId: string;
    cycleSequence: number;
    stageKind: string;
    status: string;
    reasonCode: string;
    sourceRefsJson: string;
    proofRefsJson: string;
    traceRefsJson: string;
    payloadJson: string;
    observedAt: string;
    redacted: number;
}
export interface HeartbeatCycleTraceRow {
    id: string;
    cycleSequence: number;
    startedAt: string;
    closedAt: string | null;
    closureRecordId: string | null;
    stageEventIdsJson: string;
    degradedReasonsJson: string;
    blockedReasonsJson: string;
}
export interface ActivityThreadHealthRow {
    threadId: string;
    threadStatus: ActivityThreadStatus;
    status: HealthOverall;
    reasonCode: string | null;
    completedStepCount: number;
    lastHeartbeatSequence: number;
    closureLinked: boolean;
    sourceRefsJson: string;
    observedAt: string;
}
export interface AutonomousChangeLedgerRow {
    id: string;
    changeKind: string;
    targetId: string;
    previousStableRef: string | null;
    gateResultsJson?: string;
    rollbackRef?: string;
    rollbackCommandHint?: string;
    sourceRefsJson: string;
    redactedPayloadJson?: string;
    status: string;
    createdAt: string;
    activatedAt?: string;
    rolledBackAt?: string;
}
export interface DigestRow {
    id: string;
    windowStart: string;
    windowEnd: string;
    sectionsJson: string;
    sourceRefCount: number;
    generatedAt: string;
}
export interface ToolRoutineRegistrySnapshot {
    workspaceRoot: string;
    routines: {
        routineId: string;
        capabilityPattern: string;
        version: string;
        status: RoutineRegistryStatus;
        rollbackRef?: string;
        healthReason?: "routine_permission_expansion_denied" | "routine_guard_validation_failed" | "routine_install_pending";
        sourceRefs: SourceRef[];
    }[];
}
export interface ConnectorEvolutionResult {
    planId: string;
    platformId: string;
    gates: {
        name: string;
        result: "pass" | "fail" | "skipped";
    }[];
    canaryResult?: "pass" | "fail";
    rollbackAttempted?: boolean;
    rollbackSucceeded?: boolean;
    activeVersionRef?: string;
    previousStableRef?: string;
}
export interface LoopStatusQuery {
    workspaceRoot: string;
    windowHours?: number;
    cycleSequence?: number;
}
export interface ContinuityStatusQuery {
    workspaceRoot: string;
    cardResult: SelfContinuityCardAssemblyResult;
}
export interface RoutineStatusQuery {
    workspaceRoot: string;
    registrySnapshot: ToolRoutineRegistrySnapshot;
}
export interface ConnectorEvolutionStatusQuery {
    workspaceRoot: string;
    planResult: ConnectorEvolutionResult;
}
export interface DigestRequest {
    workspaceRoot: string;
    windowStart?: string;
    windowEnd?: string;
}
export type TimelineFamily = "stage_event" | "ledger" | "digest" | "character_frame_event";
export interface TimelineQueryRequest {
    workspaceRoot: string;
    windowStart?: string;
    windowEnd?: string;
    family?: TimelineFamily;
    kind?: string;
    sourceRef?: string;
    limit?: number;
    cursor?: string;
}
export interface ProjectionLifecycleEvent {
    projectionKind: "memory" | "procedural" | "self_continuity" | "connector_evolution";
    projectionId: string;
    lifecycleStatus: "active" | "accepted" | "rejected" | "superseded" | "retired";
    sourceRefs: SourceRef[];
    observedAt: string;
}
export interface CharacterFrameObservabilityEvent {
    frameId: string;
    projectionState: CharacterFrameStatus;
    sourceRefCount: number;
    contestStatus: "none" | "accepted" | "rejected" | "revised";
    observedAt: string;
}
export interface SelfContinuityCardAssemblyResult {
    kind: "assembled" | "unavailable";
    card?: SelfContinuityCard;
    projections: (MemoryProjection | ProceduralProjection)[];
    isStale: boolean;
    reasonCode?: string;
}
export interface LoopHealth {
    windowStart: string;
    windowEnd: string;
    overall: HealthOverall;
    stageAttribution: Record<LoopStageKind, StageEventStatus>;
    activityTerminalCounts: {
        active: number;
        paused: number;
        completed: number;
        abandoned: number;
        blocked: number;
    };
    reasons: string[];
    rollbackBlocked: boolean;
}
export interface ContinuityHealth {
    cardAvailable: boolean;
    cardSourceRefCount: number;
    unavailableReason?: string;
    projectionFreshness: "fresh" | "stale" | "missing";
    memoryProjectionCount: number;
    proceduralProjectionCount: number;
}
export interface RoutineHealth {
    installedCount: number;
    pendingValidationCount: number;
    deniedCount: number;
    rollbackReady: boolean;
    reasons: string[];
}
export interface ConnectorEvolutionHealth {
    activeVersionRef?: string;
    previousStableRef?: string;
    gateSummary: Record<string, "pass" | "fail" | "skipped">;
    canaryResult: "pass" | "fail" | "not_run";
    rollbackStatus: "not_needed" | "success" | "failed";
    blockedReason?: string;
}
export interface RollbackHealth {
    status: HealthOverall;
    rollbackBlocked: boolean;
    reason?: string;
    inferred?: boolean;
}
export interface Digest {
    id: string;
    windowStart: string;
    windowEnd: string;
    sections: {
        loop: LoopHealth;
        continuity: ContinuityHealth;
        routine: RoutineHealth;
        connectorEvolution: ConnectorEvolutionHealth;
    };
    sourceRefCount: number;
    generatedAt: string;
}
export interface TimelineRow {
    id: string;
    occurredAt: string;
    family: TimelineFamily;
    kind: string;
    sourceRefs: SourceRef[];
    redactedPayloadJson?: string;
    reasonCode: string;
}
export interface TimelinePage {
    rows: TimelineRow[];
    nextCursor?: string;
}
export type V9ReasonCode = "attention_hint_without_agent_or_routine_intent" | "attention_blocked_missing_sources" | "activity_thread_stale" | "activity_thread_overlong" | "activity_thread_missing_closure" | "activity_thread_blocked" | "continuity_unavailable" | "continuity_stale_projections" | "character_frame_insufficient_sources" | "character_refresh_input_invalid" | "character_refresh_input_redacted" | "character_frame_deferred" | "proposal_created" | "proposal_no_action" | "proposal_missing_source_refs" | "proposal_risk_blocked" | "policy_allowed" | "policy_deferred_owner_confirmation" | "policy_downgraded_to_draft" | "policy_denied_missing_permission" | "policy_denied_high_risk" | "policy_denied_breaker_open" | "closure_completed" | "closure_no_action" | "closure_denied" | "closure_deferred" | "closure_downgraded" | "routine_guard_schema_invalid" | "routine_permission_expansion_denied" | "routine_guard_policy_denied" | "routine_validation_pending" | "routine_invocation_denied" | "evolution_gate_schema_failed" | "evolution_gate_permission_failed" | "evolution_gate_sandbox_failed" | "evolution_gate_fixture_failed" | "evolution_gate_wet_probe_failed" | "evolution_canary_failed" | "evolution_rollback_failed" | "ledger_missing_source_refs" | "ledger_redaction_blocked" | "v8_legacy_judgment_mapped" | "loop_healthy" | "loop_degraded_missing_closure" | "loop_blocked_rollback_failed" | "loop_blocked_gate_failure" | "timeline_window_too_large" | "timeline_window_truncated" | "state_unreadable" | "no_actionable_intent" | "policy_denied_missing_sources" | "guidance_unavailable" | "runtime_unavailable";
export type AffordanceAccessLevel = "none" | "needs_auth" | "credentialed";
export type AffordanceReliabilityLevel = "unproven" | "proven" | "stale" | "degraded";
export type AffordanceFamiliarityLevel = "scaffold" | "practiced" | "routine";
export interface AffordancePosture {
    platformId: string;
    capabilityId: string;
    accessLevel: AffordanceAccessLevel;
    reliabilityLevel: AffordanceReliabilityLevel;
    familiarityLevel: AffordanceFamiliarityLevel;
    lastProbedAt?: string;
    lastExecutedAt?: string;
    routineId?: string;
    sourceRefs: SourceRef[];
}
export interface AffordanceQuery {
    platformId?: string;
    capabilityId?: string;
}
