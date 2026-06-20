/**
 * v8 Living Perception Loop entity schemas.
 *
 * Core logic: Persist EvidenceItem, PerceptionCard, JudgmentVerdict,
 * ActionClosureRecord, QuietDailyReview, DreamConsolidationRun,
 * LongTermMemoryProjection, HeartbeatCycleTrace, and LoopStageEvent.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/state-memory-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
 *
 * Dependencies: drizzle-orm/sqlite-core
 * Boundary: Schema definitions only; no runtime logic.
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ───────────────────────────────────────────────────────────────
// 1. EvidenceItem
// ───────────────────────────────────────────────────────────────

export const evidenceItem = sqliteTable("evidence_item", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  platformId: text("platform_id").notNull(),
  contentHash: text("content_hash").notNull(),
  observedAt: text("observed_at").notNull(),
  sensitivityHint: text("sensitivity_hint"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("pending"),
}, (table) => ({
  platformContentHashIdx: uniqueIndex("evidence_item_platform_content_hash_idx").on(table.platformId, table.contentHash),
}));

export type EvidenceItemRecord = typeof evidenceItem.$inferSelect;
export type NewEvidenceItemRecord = typeof evidenceItem.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 2. PerceptionCard
// ───────────────────────────────────────────────────────────────

export const perceptionCard = sqliteTable("perception_card", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  cycleId: text("cycle_id").notNull(),
  topic: text("topic"),
  entitiesJson: text("entities_json"),
  novelty: text("novelty"),
  relevance: real("relevance"),
  relevanceClass: text("relevance_class"),
  summary: text("summary"),
  riskFlagsJson: text("risk_flags_json"),
  confidence: real("confidence"),
  reviewPriority: text("review_priority"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("pending"),
});

export type PerceptionCardRecord = typeof perceptionCard.$inferSelect;
export type NewPerceptionCardRecord = typeof perceptionCard.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 3. JudgmentVerdict
// ───────────────────────────────────────────────────────────────

export const judgmentVerdict = sqliteTable("judgment_verdict", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  cycleId: text("cycle_id").notNull(),
  perceptionCardId: text("perception_card_id").notNull(),
  actionKind: text("action_kind").notNull(),
  confidence: real("confidence"),
  reason: text("reason"),
  riskPosture: text("risk_posture"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("pending"),
});

export type JudgmentVerdictRecord = typeof judgmentVerdict.$inferSelect;
export type NewJudgmentVerdictRecord = typeof judgmentVerdict.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 4. ActionClosureRecord
// ───────────────────────────────────────────────────────────────

export const actionClosureRecord = sqliteTable("action_closure_record", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  cycleId: text("cycle_id").notNull(),
  platformId: text("platform_id"),
  capabilityId: text("capability_id"),
  proposalId: text("proposal_id"),
  decisionId: text("decision_id"),
  status: text("status").notNull(),
  reason: text("reason"),
  nextState: text("next_state"),
  sourceRefsJson: text("source_refs_json").notNull(),
  proofRefsJson: text("proof_refs_json"),
  traceRefsJson: text("trace_refs_json"),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
});

export type ActionClosureRecordSelect = typeof actionClosureRecord.$inferSelect;
export type ActionClosureRecordInsert = typeof actionClosureRecord.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 5. QuietDailyReview
// ───────────────────────────────────────────────────────────────

export const quietDailyReview = sqliteTable("quiet_daily_review", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  day: text("day").notNull(),
  closureCount: integer("closure_count").notNull().default(0),
  memoryCandidateCount: integer("memory_candidate_count").notNull().default(0),
  sourceRefsJson: text("source_refs_json").notNull(),
  closureRefsJson: text("closure_refs_json"),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("pending"),
});

export type QuietDailyReviewRecord = typeof quietDailyReview.$inferSelect;
export type NewQuietDailyReviewRecord = typeof quietDailyReview.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 6. DreamConsolidationRun
// ───────────────────────────────────────────────────────────────

export const dreamConsolidationRun = sqliteTable("dream_consolidation_run", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  quietReviewId: text("quiet_review_id").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
});

export type DreamConsolidationRunRecord = typeof dreamConsolidationRun.$inferSelect;
export type NewDreamConsolidationRunRecord = typeof dreamConsolidationRun.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 7. LongTermMemoryProjection
// ───────────────────────────────────────────────────────────────

export const longTermMemoryProjection = sqliteTable("long_term_memory_projection", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  candidateId: text("candidate_id").notNull(),
  topicKey: text("topic_key").notNull(),
  status: text("status").notNull().default("candidate"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
});

export type LongTermMemoryProjectionRecord = typeof longTermMemoryProjection.$inferSelect;
export type NewLongTermMemoryProjectionRecord = typeof longTermMemoryProjection.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 8. HeartbeatCycleTrace
// ───────────────────────────────────────────────────────────────

export const heartbeatCycleTrace = sqliteTable("heartbeat_cycle_trace", {
  id: text("id").primaryKey(),
  cycleSequence: integer("cycle_sequence").notNull(),
  heartbeatStartedAt: text("heartbeat_started_at").notNull(),
  heartbeatCompletedAt: text("heartbeat_completed_at"),
  inputCount: integer("input_count").notNull().default(0),
  outputCount: integer("output_count").notNull().default(0),
  expectedDownstreamByCycle: integer("expected_downstream_by_cycle"),
  status: text("status").notNull(),
  sourceRefsJson: text("source_refs_json"),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
});

export type HeartbeatCycleTraceRecord = typeof heartbeatCycleTrace.$inferSelect;
export type NewHeartbeatCycleTraceRecord = typeof heartbeatCycleTrace.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 9. LoopStageEvent
// ───────────────────────────────────────────────────────────────

export const loopStageEvent = sqliteTable("loop_stage_event", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  cycleSequence: integer("cycle_sequence").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  sourceRefsJson: text("source_refs_json").notNull(),
  proofRefsJson: text("proof_refs_json"),
  traceRefsJson: text("trace_refs_json"),
  redactionClass: text("redaction_class").notNull().default("none"),
  occurredAt: text("occurred_at").notNull(),
  expectedDownstreamByCycle: integer("expected_downstream_by_cycle"),
  payloadJson: text("payload_json"),
});

export type LoopStageEventRecord = typeof loopStageEvent.$inferSelect;
export type NewLoopStageEventRecord = typeof loopStageEvent.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 10. ImpulseContextArtifact
// ───────────────────────────────────────────────────────────────

export const impulseContextArtifact = sqliteTable("impulse_context_artifact", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  sceneType: text("scene_type").notNull(),
  capabilityIntent: text("capability_intent"),
  platformId: text("platform_id"),
  capabilityClass: text("capability_class"),
  impulseSource: text("impulse_source").notNull(),
  impulseText: text("impulse_text"),
  atmosphereText: text("atmosphere_text"),
  expressionBoundaryConstraintsJson: text("expression_boundary_constraints_json"),
  expressionBoundaryStyle: text("expression_boundary_style"),
  freshnessVersion: integer("freshness_version").notNull().default(1),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("active"),
});

export type ImpulseContextArtifactRecord = typeof impulseContextArtifact.$inferSelect;
export type NewImpulseContextArtifactRecord = typeof impulseContextArtifact.$inferInsert;

// 11. DailyRhythmState
// ───────────────────────────────────────────────────────────────

export const dailyRhythmState = sqliteTable("daily_rhythm_state", {
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  quietStatus: text("quiet_status").notNull().default("not_due"),
  dreamStatus: text("dream_status").notNull().default("not_due"),
  quietReason: text("quiet_reason"),
  dreamReason: text("dream_reason"),
  quietCompletedAt: text("quiet_completed_at"),
  dreamCompletedAt: text("dream_completed_at"),
  sourceRefsJson: text("source_refs_json").notNull(),
  payloadJson: text("payload_json"),
  updatedAt: text("updated_at").notNull(),
});

export type DailyRhythmStateRecord = typeof dailyRhythmState.$inferSelect;
export type NewDailyRhythmStateRecord = typeof dailyRhythmState.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 12. ConnectorCooldownState
// ───────────────────────────────────────────────────────────────

export const connectorCooldownState = sqliteTable("connector_cooldown_state", {
  id: text("id").primaryKey(),
  platformId: text("platform_id").notNull(),
  capabilityId: text("capability_id").notNull(),
  failureClass: text("failure_class").notNull(),
  retryAfterMs: integer("retry_after_ms"),
  blockedUntil: text("blocked_until").notNull(),
  failureCount: integer("failure_count").notNull().default(1),
  terminalCount: integer("terminal_count").notNull().default(0),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  platformCapabilityIdx: index("connector_cooldown_state_platform_capability_idx").on(table.platformId, table.capabilityId),
}));

export type ConnectorCooldownStateRecord = typeof connectorCooldownState.$inferSelect;
export type NewConnectorCooldownStateRecord = typeof connectorCooldownState.$inferInsert;
