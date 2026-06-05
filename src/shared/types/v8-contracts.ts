/**
 * v8 Shared Contracts — Cross-system value contracts for Living Perception Loop.
 *
 * Core logic: Single source of truth for types that would otherwise be
 * duplicated across perception-judgment, action-closure-policy,
 * dream-quiet-memory, observability-health, and control-plane systems.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §1`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §2`
 *
 * Dependencies: none (primitive shared types).
 * Boundary: Type definitions only; no runtime logic.
 * Test coverage: tests/unit/contracts/v8-shared-contracts.test.ts
 */

// ───────────────────────────────────────────────────────────────
// 1. Platform-Neutral Action Contract
// ───────────────────────────────────────────────────────────────

export type PlatformNeutralActionKind =
  | "ignore"
  | "watch"
  | "remember"
  | "notify_owner"
  | "draft_reply"
  | "auto_reply"
  | "draft_publish"
  | "auto_publish"
  | "run_connector";

export type ActionSideEffectClass =
  | "none"
  | "local_state"
  | "owner_attention"
  | "external_write"
  | "external_read"
  | "capability_declared";

export type ActionAttentionClass =
  | "none"
  | "owner_visible"
  | "external_visible"
  | "depends_on_capability";

export interface ActionKindMetadata {
  kind: PlatformNeutralActionKind;
  sideEffectClass: ActionSideEffectClass;
  attentionClass: ActionAttentionClass;
  requiresPolicyDecision: boolean;
  allowedDowngrades: PlatformNeutralActionKind[];
}

export type ConnectorCapabilitySideEffect =
  | "external_read"
  | "external_write"
  | "local_state"
  | "unknown";

// ───────────────────────────────────────────────────────────────
// 2. SourceRef Contract
// ───────────────────────────────────────────────────────────────

export type SourceRefFamily =
  | "evidence"
  | "perception"
  | "judgment"
  | "action_closure"
  | "quiet_review"
  | "dream_run"
  | "memory_projection"
  | "projection"
  | "tool_experience"
  | "connector_result"
  | "audit";

export type RedactionClass = "none" | "redacted" | "blocked";

export type SensitivityClass =
  | "public_technical"
  | "public_general"
  | "private_context"
  | "sensitive";

export type SourceResolveStatus =
  | "resolvable"
  | "missing"
  | "redacted"
  | "permission_denied";

export interface SourceRef {
  uri: string;
  family: SourceRefFamily;
  id: string;
  redactionClass: RedactionClass;
  sensitivityClass?: SensitivityClass;
  resolveStatus?: SourceResolveStatus;
  resolveFailureReason?: string;
}

// ───────────────────────────────────────────────────────────────
// 3. HeartbeatCycleTrace and LoopStageEvent
// ───────────────────────────────────────────────────────────────

export type HeartbeatCycleStatus =
  | "started"
  | "completed"
  | "failed"
  | "degraded";

export interface HeartbeatCycleTrace {
  cycleId: string;
  cycleSequence: number;
  heartbeatStartedAt: string;
  heartbeatCompletedAt?: string;
  inputCount: number;
  outputCount: number;
  expectedDownstreamByCycle?: number;
  status: HeartbeatCycleStatus;
}

export type LoopStage =
  | "ingestion"
  | "perception"
  | "judgment"
  | "policy"
  | "execution"
  | "closure"
  | "quiet"
  | "dream"
  | "projection";

export type LoopStageEventStatus =
  | "started"
  | "completed"
  | "skipped"
  | "blocked"
  | "failed";

export interface LoopStageEvent {
  id: string;
  cycleId: string;
  cycleSequence: number;
  stage: LoopStage;
  status: LoopStageEventStatus;
  reason?: V8ReasonCode;
  sourceRefs: SourceRef[];
  redactionClass: RedactionClass;
  occurredAt: string;
  expectedDownstreamByCycle?: number;
  payloadJson?: string;
}

// ───────────────────────────────────────────────────────────────
// 4. Memory Review Closure Contract
// ───────────────────────────────────────────────────────────────

export type MemoryReviewClosureSubtype = "remember_for_review";

export interface MemoryReviewCandidateClosure {
  closureSubtype: MemoryReviewClosureSubtype;
  perceptionRef: SourceRef;
  judgmentVerdictRef: SourceRef;
  topicKey: string;
  memoryIntentReason: string;
  reviewPriority: "low" | "medium" | "high";
  sourceRefs: [SourceRef, ...SourceRef[]];
}

// ───────────────────────────────────────────────────────────────
// 5. Cross-System Degraded Response Contract
// ───────────────────────────────────────────────────────────────

export interface DegradedOperationResult {
  status: "degraded" | "blocked";
  reason: V8ReasonCode;
  ownerStage: LoopStage;
  sourceRefs: SourceRef[];
  operatorNextAction: string;
  retryable: boolean;
}

// ───────────────────────────────────────────────────────────────
// 6. Reason-Code Registry
// ───────────────────────────────────────────────────────────────

export type V8ReasonCode =
  // Quiet / Dream / Projection
  | "quiet_completed"
  | "quiet_empty_input"
  | "quiet_state_unreadable"
  | "quiet_validation_failed"
  | "dream_scheduled"
  | "dream_scheduler_unavailable"
  | "dream_started"
  | "dream_completed"
  | "dream_failed"
  | "dream_blocked_redaction"
  | "projection_candidate_created"
  | "projection_accepted"
  | "projection_rejected"
  | "projection_superseded"
  // Action / Policy / Closure
  | "proposal_created"
  | "proposal_no_action"
  | "proposal_missing_source_refs"
  | "proposal_risk_blocked"
  | "policy_allowed"
  | "policy_deferred_owner_confirmation"
  | "policy_downgraded_to_draft"
  | "policy_denied_missing_permission"
  | "policy_denied_high_risk"
  | "policy_denied_breaker_open"
  | "guidance_unavailable"
  | "closure_completed"
  | "closure_no_action"
  | "closure_denied"
  | "closure_deferred"
  | "closure_downgraded"
  | "closure_downgraded_without_draft"
  | "closure_failed"
  // Perception / Judgment / Observability
  | "perception_rules_only"
  | "evidence_batch_empty"
  | "evidence_batch_truncated"
  | "judgment_low_confidence"
  | "judgment_missing_source_refs"
  | "source_refs_unresolved"
  | "state_unreadable"
  | "stage_event_missing"
  // Ingestion / Execution
  | "ingestion_no_data"
  | "ingestion_empty"
  | "ingestion_state_unreadable"
  | "ingestion_connector_failed"
  | "execution_completed"
  | "execution_failed"
  | "execution_timeout"
  | "execution_unavailable";

// ───────────────────────────────────────────────────────────────
// 7. Action Kind Registry Metadata Table
// ───────────────────────────────────────────────────────────────

export const ACTION_KIND_REGISTRY: Readonly<
  Record<PlatformNeutralActionKind, ActionKindMetadata>
> = {
  ignore: {
    kind: "ignore",
    sideEffectClass: "none",
    attentionClass: "none",
    requiresPolicyDecision: false,
    allowedDowngrades: [],
  },
  watch: {
    kind: "watch",
    sideEffectClass: "local_state",
    attentionClass: "none",
    requiresPolicyDecision: false,
    allowedDowngrades: [],
  },
  remember: {
    kind: "remember",
    sideEffectClass: "local_state",
    attentionClass: "none",
    requiresPolicyDecision: true,
    allowedDowngrades: ["watch"],
  },
  notify_owner: {
    kind: "notify_owner",
    sideEffectClass: "owner_attention",
    attentionClass: "owner_visible",
    requiresPolicyDecision: true,
    allowedDowngrades: ["watch"],
  },
  draft_reply: {
    kind: "draft_reply",
    sideEffectClass: "local_state",
    attentionClass: "owner_visible",
    requiresPolicyDecision: true,
    allowedDowngrades: ["notify_owner", "watch"],
  },
  auto_reply: {
    kind: "auto_reply",
    sideEffectClass: "external_write",
    attentionClass: "external_visible",
    requiresPolicyDecision: true,
    allowedDowngrades: ["draft_reply", "notify_owner", "watch"],
  },
  draft_publish: {
    kind: "draft_publish",
    sideEffectClass: "local_state",
    attentionClass: "owner_visible",
    requiresPolicyDecision: true,
    allowedDowngrades: ["notify_owner", "watch"],
  },
  auto_publish: {
    kind: "auto_publish",
    sideEffectClass: "external_write",
    attentionClass: "external_visible",
    requiresPolicyDecision: true,
    allowedDowngrades: ["draft_publish", "notify_owner", "watch"],
  },
  run_connector: {
    kind: "run_connector",
    sideEffectClass: "capability_declared",
    attentionClass: "depends_on_capability",
    requiresPolicyDecision: true,
    allowedDowngrades: ["notify_owner", "watch"],
  },
};
