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