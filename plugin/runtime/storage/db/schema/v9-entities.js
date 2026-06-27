/**
 * v9 Self Continuity, Character & Procedural Evolution entity schemas.
 *
 * Core logic: Persist AttentionSignal, ActivityThread, ActivityStep,
 * ProceduralProjection, ToolRoutine, SelfContinuityCard, CharacterFrame,
 * ConnectorEvolutionPlan, ConnectorVersion, AutonomousChangeLedger, and
 * RoutineExecutionTrace.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
 *
 * Dependencies: drizzle-orm/sqlite-core
 * Boundary: Schema definitions only; no runtime logic.
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
// ───────────────────────────────────────────────────────────────
// 1. AttentionSignal
// ───────────────────────────────────────────────────────────────
export const attentionSignal = sqliteTable("attention_signal", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    cycleId: text("cycle_id").notNull(),
    evidenceRefsJson: text("evidence_refs_json"),
    novelty: real("novelty").notNull().default(0),
    relevance: real("relevance").notNull().default(0),
    repetition: text("repetition").notNull(),
    riskFlagsJson: text("risk_flags_json"),
    possibleActionsJson: text("possible_actions_json"),
    sourceRefsJson: text("source_refs_json").notNull(),
    status: text("status").notNull(),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
    activityThreadId: text("activity_thread_id"),
    threadSuggestion: text("thread_suggestion"),
}, (table) => ({
    cycleIdIdx: index("attention_signal_cycle_id_idx").on(table.cycleId),
    threadIdx: index("attention_signal_thread_idx").on(table.activityThreadId),
}));
// ───────────────────────────────────────────────────────────────
// 2. ActivityThread
// ───────────────────────────────────────────────────────────────
export const activityThread = sqliteTable("activity_thread", {
    id: text("id").primaryKey(),
    originAttentionSignalId: text("origin_attention_signal_id").notNull(),
    status: text("status").notNull(),
    currentFocus: text("current_focus").notNull(),
    associationsJson: text("associations_json"),
    nextPossibleMovesJson: text("next_possible_moves_json"),
    completedStepCount: integer("completed_step_count").notNull().default(0),
    lastStepKind: text("last_step_kind"),
    blockerReason: text("blocker_reason"),
    stopCondition: text("stop_condition").notNull(),
    lastHeartbeatSequence: integer("last_heartbeat_sequence").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => ({
    statusUpdatedAtIdx: index("activity_thread_status_updated_at_idx").on(table.status, table.updatedAt),
    originAttentionIdx: index("activity_thread_origin_attention_idx").on(table.originAttentionSignalId),
    heartbeatSeqIdx: index("activity_thread_heartbeat_seq_idx").on(table.lastHeartbeatSequence),
}));
// ───────────────────────────────────────────────────────────────
// 3. ActivityStep
// ───────────────────────────────────────────────────────────────
export const activityStep = sqliteTable("activity_step", {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    cycleId: text("cycle_id").notNull(),
    stepKind: text("step_kind").notNull(),
    summary: text("summary").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    closureRefJson: text("closure_ref_json"),
    createdAt: text("created_at").notNull(),
}, (table) => ({
    threadCreatedAtIdx: index("activity_step_thread_created_at_idx").on(table.threadId, table.createdAt),
    cycleIdIdx: index("activity_step_cycle_id_idx").on(table.cycleId),
}));
// ───────────────────────────────────────────────────────────────
// 4. ProceduralProjection
// ───────────────────────────────────────────────────────────────
export const proceduralProjection = sqliteTable("procedural_projection", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    candidateId: text("candidate_id").notNull(),
    capabilityPattern: text("capability_pattern").notNull(),
    status: text("status").notNull().default("candidate"),
    sourceRefsJson: text("source_refs_json").notNull(),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
}, (table) => ({
    capabilityStatusIdx: index("procedural_projection_capability_status_idx").on(table.capabilityPattern, table.status),
}));
// ───────────────────────────────────────────────────────────────
// 5. ToolRoutine
// ───────────────────────────────────────────────────────────────
export const toolRoutine = sqliteTable("tool_routine", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    capabilityPattern: text("capability_pattern").notNull(),
    status: text("status").notNull().default("candidate"),
    sourceRefsJson: text("source_refs_json").notNull(),
    rollbackRef: text("rollback_ref"),
    guardRefsJson: text("guard_refs_json"),
    ledgerRef: text("ledger_ref"),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
    activatedAt: text("activated_at"),
    retiredAt: text("retired_at"),
}, (table) => ({
    routineIdStatusIdx: index("tool_routine_status_idx").on(table.status),
    capabilityIdx: index("tool_routine_capability_idx").on(table.capabilityPattern),
}));
// ───────────────────────────────────────────────────────────────
// 6. SelfContinuityCard
// ───────────────────────────────────────────────────────────────
export const selfContinuityCard = sqliteTable("self_continuity_card", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    version: integer("version").notNull().default(1),
    cardText: text("card_text").notNull(),
    sectionsJson: text("sections_json").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    characterFramePointerJson: text("character_frame_pointer_json").notNull(),
    status: text("status").notNull().default("active"),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
}, (table) => ({
    statusIdx: index("self_continuity_card_status_idx").on(table.status),
}));
// ───────────────────────────────────────────────────────────────
// 7. CharacterFrame
// ───────────────────────────────────────────────────────────────
export const characterFrame = sqliteTable("character_frame", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    version: integer("version").notNull().default(1),
    validFrom: text("valid_from").notNull(),
    sectionsJson: text("sections_json").notNull(),
    contestPrompt: text("contest_prompt").notNull(),
    charCount: integer("char_count").notNull().default(0),
    sourceRefsJson: text("source_refs_json").notNull(),
    status: text("status").notNull().default("candidate"),
    supersededBy: text("superseded_by"),
    revisionOf: text("revision_of"),
    acceptedAt: text("accepted_at"),
    validUntil: text("valid_until"),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
}, (table) => ({
    statusIdx: index("character_frame_status_idx").on(table.status),
}));
// ───────────────────────────────────────────────────────────────
// 8. ConnectorEvolutionPlan
// ───────────────────────────────────────────────────────────────
export const connectorEvolutionPlan = sqliteTable("connector_evolution_plan", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    platformId: text("platform_id").notNull(),
    planType: text("plan_type").notNull(),
    status: text("status").notNull().default("proposed"),
    gateResultsJson: text("gate_results_json"),
    previousStableRef: text("previous_stable_ref"),
    rollbackCommandHint: text("rollback_command_hint"),
    sourceRefsJson: text("source_refs_json").notNull(),
    ledgerRef: text("ledger_ref"),
    redactionClass: text("redaction_class").notNull().default("none"),
    payloadJson: text("payload_json"),
}, (table) => ({
    platformStatusIdx: index("connector_evolution_plan_platform_status_idx").on(table.platformId, table.status),
}));
// ───────────────────────────────────────────────────────────────
// 9. ConnectorVersion
// ───────────────────────────────────────────────────────────────
export const connectorVersion = sqliteTable("connector_version", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    platformId: text("platform_id").notNull(),
    versionId: text("version_id").notNull(),
    sequence: integer("sequence"),
    assetPathsJson: text("asset_paths_json"),
    declaredCapabilitiesJson: text("declared_capabilities_json"),
    status: text("status").notNull().default("candidate"),
    previousStableRef: text("previous_stable_ref"),
    rollbackRef: text("rollback_ref"),
    rollbackCommandHint: text("rollback_command_hint"),
    sourceRefsJson: text("source_refs_json").notNull(),
    payloadJson: text("payload_json"),
    activatedAt: text("activated_at"),
    rolledBackAt: text("rolled_back_at"),
}, (table) => ({
    platformVersionIdx: index("connector_version_platform_version_idx").on(table.platformId, table.versionId),
    statusIdx: index("connector_version_status_idx").on(table.status),
}));
// ───────────────────────────────────────────────────────────────
// 10. AutonomousChangeLedger
// ───────────────────────────────────────────────────────────────
export const autonomousChangeLedger = sqliteTable("autonomous_change_ledger", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    workspaceRoot: text("workspace_root").notNull(),
    changeKind: text("change_kind").notNull(),
    targetId: text("target_id").notNull(),
    previousStableRef: text("previous_stable_ref"),
    status: text("status").notNull().default("proposed"),
    gateResultsJson: text("gate_results_json"),
    rollbackRef: text("rollback_ref"),
    rollbackCommandHint: text("rollback_command_hint"),
    sourceRefsJson: text("source_refs_json").notNull(),
    redactedPayloadJson: text("redacted_payload_json"),
    activatedAt: text("activated_at"),
    rolledBackAt: text("rolled_back_at"),
}, (table) => ({
    targetStatusIdx: index("autonomous_change_ledger_target_status_idx").on(table.targetId, table.status),
    changeKindIdx: index("autonomous_change_ledger_change_kind_idx").on(table.changeKind),
}));
// ───────────────────────────────────────────────────────────────
// 11. RoutineExecutionTrace
// ───────────────────────────────────────────────────────────────
export const routineExecutionTrace = sqliteTable("routine_execution_trace", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    routineId: text("routine_id").notNull(),
    cycleId: text("cycle_id").notNull(),
    status: text("status").notNull(),
    sourceRefsJson: text("source_refs_json").notNull(),
    proofRefsJson: text("proof_refs_json"),
    traceRefsJson: text("trace_refs_json"),
    payloadJson: text("payload_json"),
}, (table) => ({
    routineIdx: index("routine_execution_trace_routine_idx").on(table.routineId),
    cycleIdx: index("routine_execution_trace_cycle_idx").on(table.cycleId),
}));
// ───────────────────────────────────────────────────────────────
// Local helpers
// ───────────────────────────────────────────────────────────────
// (none currently)
