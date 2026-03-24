export { createObservabilityDatabase, type ObservabilityDatabase } from "./db/index.js";
export * as obsSchema from "./db/schema/index.js";

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

export { DecisionLedger, type QuietLifecycleEvent, type OutreachDecision } from "./services/decision-ledger.js";
export { GovernanceAudit, type CredentialLifecycleAudit } from "./services/governance-audit.js";
export { ExecutionTelemetry, type ExecutionAttemptInput } from "./services/execution-telemetry.js";