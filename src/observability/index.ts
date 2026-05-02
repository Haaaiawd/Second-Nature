export { createObservabilityDatabase, type ObservabilityDatabase } from "./db/index.js";
export * as obsSchema from "./db/schema/index.js";

export {
  buildAuditEnvelope,
  computeAuditRecordHash,
  redactAuditEvent,
  auditManifestFromFieldManifest,
  type AuditEnvelope,
  type AuditEnvelopeSensitivity,
  type AuditEventFamily,
  type AuditPlane,
  type AuditRedactionManifest,
  type AuditIntegrity,
  type BuildAuditEnvelopeInput,
  type RedactAuditEventResult,
} from "./audit/audit-envelope.js";
export { AppendOnlyAuditStore } from "./audit/append-only-audit-store.js";
export {
  verifyAuditHashChain,
  createAppendOnlyAuditStoreRangeLoader,
  type AuditExportRange,
  type AuditHashChainVerificationReport,
  type AuditHashChainVerificationStatus,
  type VerifyAuditHashChainDeps,
} from "./audit/verify-audit-hash-chain.js";

export {
  REDACTION_CONFIG,
  DEFAULT_REDACTION_POLICY,
  getFieldRedactionRule,
  type RedactionPolicy,
  type RedactionRule,
  type SensitivityLevel,
} from "./redaction/policy.js";

export {
  redactEvent,
  createEmptyManifest,
  mergeManifests,
  type RedactionManifest,
  type RedactionResult,
} from "./redaction/manifest.js";

export { DecisionLedger, type QuietLifecycleEvent, type OutreachDecision, type HeartbeatDecisionEvent } from "./services/decision-ledger.js";
export { GovernanceAudit, type CredentialLifecycleAudit } from "./services/governance-audit.js";
export { ExecutionTelemetry, type ExecutionAttemptInput } from "./services/execution-telemetry.js";

export {
  LivedExperienceAuditRecorder,
  createLivedExperienceAuditRecorder,
  type DecisionTracePayload,
  type DeliveryAuditPayload,
  type DeliveryAuditStatus,
  type ExplainLinkageSummary,
  type GuidanceGroundingAuditPayload,
  type SourceCoverageAuditPayload,
} from "./services/lived-experience-audit.js";

export {
  GovernancePlaneRecorder,
  createGovernancePlaneRecorder,
  type AuditAppendAck,
  type ConnectorAttemptAudit,
  type ConnectorAttemptOutcome,
  type StateGovernanceAudit,
  type StateGovernanceKind,
} from "./services/governance-plane-recorder.js";

export {
  queryExplain,
  type ExplainQuery,
  type OperatorExplainReadModel,
  type RedactedExplainEvent,
} from "./query/explain-query.js";
export { exportAuditBundle, type AuditBundle, type AuditBundleExportRange, type AuditRedactionSummary, type ExportAuditBundleDeps } from "./query/export-audit-bundle.js";

export {
  EvidenceQueryEngine,
} from "./query/evidence-query-engine.js";
export type {
  EvidenceQuery,
  EvidenceBundle,
  EvidenceResolutionPlan,
  GovernanceEvidenceRecord,
  ResolvedContentRef,
  ExplanationCapsule,
} from "./query/compose-evidence.js";

export {
  projectReflectionAudit,
  type ReflectionAudit,
  type ReflectionAuditProjection,
} from "./projections/reflection-audit.js";

export {
  projectOutreachQualityAudit,
  type OutreachQualityAudit,
  type OutreachQualityProjection,
} from "./projections/outreach-quality-audit.js";

export {
  projectGuidanceParticipationAudit,
  type GuidanceParticipationAudit,
  type GuidanceParticipationProjection,
} from "./projections/guidance-audit.js";
