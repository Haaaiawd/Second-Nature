import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const decisionLedger = sqliteTable("decision_ledger", {
  id: text("id").primaryKey(),
  tickId: text("tick_id").notNull(),
  traceId: text("trace_id").notNull(),
  intentId: text("intent_id"),
  platformId: text("platform_id"),
  verdict: text("verdict").notNull(),
  mode: text("mode").notNull(),
  reasons: text("reasons").notNull(),
  reasonCodes: text("reason_codes").notNull(),
  decisionBasis: text("decision_basis").notNull(),
  evidenceRefs: text("evidence_refs").notNull(),
  modelEvalRef: text("model_eval_ref"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("decision_tick_idx").on(table.tickId),
  uniqueIndex("decision_trace_idx").on(table.traceId),
]);

export const executionAttempts = sqliteTable("execution_attempts", {
  id: text("id").primaryKey(),
  traceId: text("trace_id").notNull(),
  decisionId: text("decision_id").notNull(),
  intentId: text("intent_id").notNull(),
  platformId: text("platform_id").notNull(),
  capability: text("capability").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  commitState: text("commit_state"),
  failureClass: text("failure_class"),
  retryPolicy: text("retry_policy"),
  idempotencyKey: text("idempotency_key"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
}, (table) => [
  uniqueIndex("attempt_trace_idx").on(table.traceId),
  index("attempt_decision_idx").on(table.decisionId),
  index("attempt_platform_idx").on(table.platformId),
]);

export const governanceAudit = sqliteTable("governance_audit", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  proposalId: text("proposal_id"),
  targetAssetId: text("target_asset_id"),
  assetPath: text("asset_path"),
  statusFrom: text("status_from"),
  statusTo: text("status_to").notNull(),
  beforeHash: text("before_hash"),
  afterHash: text("after_hash"),
  supportingSources: text("supporting_sources"),
  reason: text("reason"),
  verificationDeadline: text("verification_deadline"),
  attemptsRemaining: integer("attempts_remaining"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("audit_proposal_idx").on(table.proposalId),
  index("audit_asset_idx").on(table.targetAssetId),
  index("audit_event_idx").on(table.eventType),
]);

export const redactionManifest = sqliteTable("redaction_manifest", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  fieldName: text("field_name").notNull(),
  action: text("action").notNull(),
  originalValueHash: text("original_value_hash"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("redact_event_idx").on(table.eventId),
]);

export type DecisionRecordDb = typeof decisionLedger.$inferSelect;
export type NewDecisionRecordDb = typeof decisionLedger.$inferInsert;

export type ExecutionAttemptDb = typeof executionAttempts.$inferSelect;
export type NewExecutionAttemptDb = typeof executionAttempts.$inferInsert;

export type GovernanceAuditDb = typeof governanceAudit.$inferSelect;
export type NewGovernanceAuditDb = typeof governanceAudit.$inferInsert;

export type RedactionManifestDb = typeof redactionManifest.$inferSelect;
export type NewRedactionManifestDb = typeof redactionManifest.$inferInsert;
