/**
 * Dream System core types.
 *
 * Dream is an async memory consolidation job. It reads source-backed life evidence,
 * session chronicle, and existing memory store, then produces a candidate MemoryStore
 * with canonical entries, insights, and optional narrative/relationship update proposals.
 *
 * Contract: input store is immutable; output is always candidate until validated and accepted.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

import type {
  CanonicalMemoryEntry,
  DreamInsight,
  MemoryStoreValidation,
} from "../storage/memory-store/memory-store-lifecycle.js";

export type { DreamInsight };

export type DreamTriggerKind =
  | "scheduled"
  | "evidence_threshold"
  | "manual"
  | "maintenance"
  | "quiet_completion";

export type DreamRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type DreamOutputStatus =
  | "candidate"
  | "accepted"
  | "archived"
  | "partial";

export type DreamMode = "rules_only" | "hybrid_llm" | "model_skipped";

export interface DreamRun {
  runId: string;
  traceId: string;
  triggerKind: DreamTriggerKind;
  status: DreamRunStatus;
  mode: DreamMode;
  startedAt: string;
  finishedAt?: string;
  inputMemoryStoreId?: string;
  outputMemoryStoreId?: string;
  fallbackReason?: string;
}

export interface ToolExperienceSummary {
  connectorId: string;
  capabilityId: string;
  outcome: string;
  count: number;
  lastRecordedAt: string;
}

export interface DreamInputBundle {
  evidenceRefs: string[];
  chronicleEntryIds: string[];
  activeMemoryStoreId?: string;
  narrativeSnapshotId?: string;
  relationshipSnapshotId?: string;
  goalSnapshotIds: string[];
  toolExperienceSummaries?: ToolExperienceSummary[];
  inputCounts: {
    evidence: number;
    chronicle: number;
    memoryEntries: number;
  };
}

export interface DreamNarrativeUpdate {
  focus: string;
  progressAdditions: string[];
  nextIntent: string;
  confidenceDelta: number;
  sourceRefs: string[];
  unsupportedClaims: string[];
}

export interface DreamRelationshipUpdate {
  toneDelta?: string;
  timingDelta?: string;
  topicDelta?: string;
  sourceRefs: string[];
  confidence: number;
}

export interface DreamOutputValidation {
  schemaValid: boolean;
  sourceGrounded: boolean;
  sensitivityClean: boolean;
  unsupportedClaims: string[];
  errors: string[];
  checkedAt: string;
}

export interface DreamOutput {
  outputId: string;
  runId: string;
  status: DreamOutputStatus;
  inputMemoryStoreId?: string;
  canonicalEntries: CanonicalMemoryEntry[];
  insights: DreamInsight[];
  narrativeUpdate?: DreamNarrativeUpdate;
  relationshipUpdate?: DreamRelationshipUpdate;
  validation: DreamOutputValidation;
}

export interface DreamTrace {
  traceId: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  llmCostUsd?: number;
  inputCounts: DreamInputBundle["inputCounts"];
  fallbackReason?: string;
  validationErrors?: string[];
  timeoutMs?: number;
  sensitivityFailure?: boolean;
}

export interface DreamRunResult {
  runId: string;
  status: DreamRunStatus;
  output?: DreamOutput;
  trace: DreamTrace;
  fallbackReason?: string;
}

// ─── Port interfaces ──────────────────────────────────────────────────────────

export interface DreamStatePort {
  loadDreamInputs(query: {
    timeWindowDays?: number;
    evidenceLimit?: number;
  }): Promise<DreamInputBundle>;
  writeDreamOutput(output: DreamOutput): Promise<{
    outputId: string;
    status: "acknowledged" | "degraded";
  }>;
  markDreamOutputLifecycle(input: {
    outputId: string;
    newStatus: DreamOutputStatus;
    validation?: DreamOutputValidation;
    updatedAt: string;
  }): Promise<{ outputId: string; status: "acknowledged" | "degraded" }>;
}

// ─── RedactedEvidenceBundle brand type (DR-027) ───────────────────────────────

/**
 * Brand type: evidence bundle that has passed through RedactionGate.
 * TypeScript prevents passing un-redacted data to ModelAssistPort.
 */
export interface RedactedEvidenceBundle {
  readonly _brand: "redacted";
  readonly evidence: readonly string[];
  readonly chronicle: readonly string[];
  readonly memory?: readonly string[];
}

export interface ModelAssistPort {
  /** Only accepts RedactedEvidenceBundle — TypeScript enforces prior redaction (DR-027). */
  extractInsights(input: RedactedEvidenceBundle): Promise<{
    insights: DreamInsight[];
    narrativeUpdate?: DreamNarrativeUpdate;
    relationshipUpdate?: DreamRelationshipUpdate;
    unsupportedClaims: string[];
    costUsd?: number;
  }>;
}

/** @deprecated Use ModelAssistPort with RedactedEvidenceBundle (DR-027). */
export interface DreamModelPort {
  extractInsights(input: {
    sampledEvidence: string[];
    chronicleSummary: string;
    activeMemorySummary?: string;
    redacted: boolean;
  }): Promise<{
    insights: DreamInsight[];
    narrativeUpdate?: DreamNarrativeUpdate;
    relationshipUpdate?: DreamRelationshipUpdate;
    unsupportedClaims: string[];
    costUsd?: number;
  }>;
}

export interface DreamTracePort {
  recordDreamTrace(trace: DreamTrace): Promise<void>;
}

export interface DreamBudgetPort {
  checkBudget(costEstimateUsd: number): Promise<{
    allowed: boolean;
    remainingUsd: number;
  }>;
}

// ─── Engine input/output ──────────────────────────────────────────────────────

export interface DreamEngineInput {
  runId: string;
  traceId: string;
  triggerKind: DreamTriggerKind;
  statePort: DreamStatePort;
  /** @deprecated Use modelAssistPort with RedactedEvidenceBundle (DR-027). */
  modelPort?: DreamModelPort;
  /**
   * v7 ModelAssistPort — requires RedactedEvidenceBundle (DR-027).
   * If both modelAssistPort and modelPort are provided, modelAssistPort takes precedence.
   */
  modelAssistPort?: ModelAssistPort;
  tracePort?: DreamTracePort;
  budgetPort?: DreamBudgetPort;
  options?: {
    timeWindowDays?: number;
    evidenceLimit?: number;
    maxCanonicalEntries?: number;
    operatorTimeoutMs?: number;
  };
}
