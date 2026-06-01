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

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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
});

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
  proposalId: text("proposal_id"),
  decisionId: text("decision_id"),
  status: text("status").notNull(),
  reason: text("reason"),
  nextState: text("next_state"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("closed"),
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
  lifecycleStatus: text("lifecycle_status").notNull().default("pending"),
});

export type DreamConsolidationRunRecord = typeof dreamConsolidationRun.$inferSelect;
export type NewDreamConsolidationRunRecord = typeof dreamConsolidationRun.$inferInsert;

// ───────────────────────────────────────────────────────────────
// 7. LongTermMemoryProjection
// ───────────────────────────────────────────────────────────────

export const longTermMemoryProjection = sqliteTable("long_term_memory_projection", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  candidateId: text("candidate_id"),
  topicKey: text("topic_key").notNull(),
  status: text("status").notNull().default("candidate"),
  sourceRefsJson: text("source_refs_json").notNull(),
  redactionClass: text("redaction_class").notNull().default("none"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("candidate"),
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
  lifecycleStatus: text("lifecycle_status").notNull().default("started"),
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
  redactionClass: text("redaction_class").notNull().default("none"),
  occurredAt: text("occurred_at").notNull(),
  expectedDownstreamByCycle: integer("expected_downstream_by_cycle"),
  payloadJson: text("payload_json"),
  lifecycleStatus: text("lifecycle_status").notNull().default("started"),
});

export type LoopStageEventRecord = typeof loopStageEvent.$inferSelect;
export type NewLoopStageEventRecord = typeof loopStageEvent.$inferInsert;
