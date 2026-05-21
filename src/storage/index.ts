export { createStateDatabase, type StateDatabase } from "./db/index.js";
export * as storageSchema from "./db/schema/index.js";
export * from "./repositories/index.js";

export { createWorkspaceArtifactStore, type WorkspaceArtifactStore } from "./memory/workspace/store.js";
export * from "./memory/workspace/paths.js";
export * from "./memory/workspace/types.js";

export { createCredentialVault, type CredentialVault } from "./services/credential-vault.js";
export { createEffectCommitStore, type EffectCommitStore } from "./services/effect-commit-store.js";
export { createDailyLogPipeline, type DailyLogPipeline } from "./services/daily-log-pipeline.js";
export { createQuietInputLoader, type QuietInputLoader } from "./services/quiet-input-loader.js";
export { createPersonaCandidateLoader, type PersonaCandidateLoader } from "./services/persona-candidate-loader.js";
export { createGovernanceLayer, type GovernanceLayer, type AnchorWriteProposal, type ProposalAck, type ApplyAck } from "./services/governance-layer.js";
export { createProvenanceService, type ProvenanceService, type ProvenanceTrace, type ProvenanceDetail } from "./services/provenance-service.js";
export {
  createRepairAndBackupService,
  type RepairAndBackupService,
  type RepairAndBackupOptions,
  type RepairAndBackupResult,
} from "./services/repair-and-backup.js";
export { runStartupRepairAndBackup } from "./bootstrap/repair.js";
export { probeNativeSqliteLoad } from "./bootstrap/native-sqlite-probe.js";
export {
  runStorageModeSmoke,
  type StorageModeSmokeReport,
  type RunStorageModeSmokeOptions,
} from "./bootstrap/storage-mode-smoke.js";
export {
  repairStateIndexes,
  type RepairSummary,
  type RepairStateIndexesOptions,
  type RepairGateStatus,
} from "./bootstrap/repair-gate.js";

export { createStateAPI, type StateAPI, type MemoryReadPort, type MemoryWritePort, type CredentialContextPort, type IntentCommitPort, type ProvenancePort } from "./state-api.js";

export {
  createSessionChronicleStore,
  type SessionChronicleStore,
  type SessionChronicleEntry,
  type ChronicleQuery,
  type ChronicleWriteAck,
  type ChronicleEventKind,
} from "./chronicle/session-chronicle-store.js";

export {
  createNarrativeStateStore,
  type NarrativeStateStore,
  type NarrativeState,
  type NarrativeStateUpdate,
  type NarrativeStateWriteAck,
} from "./narrative/narrative-state-store.js";

export {
  createRelationshipMemoryStore,
  type RelationshipMemoryStore,
  type RelationshipMemory,
  type RelationshipMemoryUpdate,
  type RelationshipMemoryWriteAck,
  type TopicAffinity,
} from "./relationship/relationship-memory-store.js";

export {
  createAgentGoalStore,
  type AgentGoalStore,
  type AgentGoal,
  type AgentGoalWrite,
  type AgentGoalStatusTransition,
  type AgentGoalQuery,
  type AgentGoalWriteAck,
} from "./goal/agent-goal-store.js";

export {
  createMemoryStoreLifecycle,
  type MemoryStorePort,
  type MemoryStore,
  type MemoryStoreWrite,
  type MemoryStoreLifecycleTransition,
  type MemoryStoreAck,
  type CanonicalMemoryEntry,
  type DreamInsight,
  type MemoryStoreValidation,
} from "./memory-store/memory-store-lifecycle.js";

export type {
  LifeEvidence,
  LifeEvidenceCandidate,
  LifeEvidenceType,
  LifeEvidenceWriteAck,
  Sensitivity,
  SourceRef,
} from "./life-evidence/types.js";
export { appendLifeEvidence, type AppendLifeEvidenceOptions } from "./life-evidence/append-life-evidence.js";

export { loadRhythmPolicySnapshot, type RhythmPolicySnapshot } from "./rhythm/rhythm-policy-snapshot.js";

export type {
  LifeEvidenceQuery,
  LifeEvidenceSnapshot,
  LifeEvidenceReadModel,
  ContinuitySnapshot,
  SourceCoverage,
} from "./snapshots/types.js";
export { loadLifeEvidenceSnapshot, type LoadLifeEvidenceSnapshotOptions } from "./snapshots/life-evidence-snapshot.js";
export { loadContinuitySnapshot, type LoadContinuitySnapshotParams } from "./snapshots/continuity-snapshot.js";

export type { UserInterestSnapshot, UserInterestSignal, UserInterestStaleness } from "./user-interest/types.js";
export { loadUserInterestSnapshot } from "./user-interest/load-user-interest-snapshot.js";

export type { DeliveryAttemptWrite, DeliveryAttemptRecord, DeliveryAttemptAck } from "./delivery/types.js";
export { writeDeliveryAttempt } from "./delivery/write-delivery-attempt.js";
export { listDeliveryAttemptsByDecisionId } from "./delivery/query-delivery-attempts.js";

export type { OperatorFallbackWrite, OperatorFallbackReason } from "./fallback/operator-fallback-types.js";
export type { OperatorFallbackView } from "./fallback/operator-fallback-view.js";
export { writeOperatorFallback, type OperatorFallbackAck } from "./fallback/write-operator-fallback.js";
export {
  loadOperatorFallbackRow,
  normalizeFallbackRef,
  toOperatorFallbackView,
} from "./fallback/load-operator-fallback.js";

export type { QuietArtifactWrite, QuietClaim, QuietArtifactKind } from "./quiet/quiet-artifact-types.js";
export {
  writeQuietArtifact,
  calculateQuietSourceCoverage,
  evidenceGroundingRatio,
  type QuietArtifactAck,
} from "./quiet/quiet-artifact-writer.js";
export { persistQuietArtifactToWorkspace, type PersistQuietArtifactResult } from "./quiet/persist-quiet-artifact.js";
