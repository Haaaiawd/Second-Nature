/**
 * Degraded Status Classifier (T-OBS.R.8)
 *
 * Core logic: map canonical V8ReasonCode values to precise operational states
 * so that stage-level diagnostics never use the aggregate "degraded" string.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §4.1`
 *
 * Dependencies: `src/shared/types/v8-contracts.js`
 * Boundary: pure function; no I/O.
 * Test coverage: tests/unit/shared/degraded-status-classifier.test.ts
 */

import type {
  DegradedOperationResult,
  V8ReasonCode,
} from "./types/v8-contracts.js";

export type PreciseDegradedStatus = DegradedOperationResult["status"];

const EMPTY_REASONS: ReadonlySet<V8ReasonCode> = new Set([
  "evidence_batch_empty",
  "evidence_content_missing",
  "ingestion_empty",
  "ingestion_no_data",
  "quiet_empty_input",
]);

const BLOCKED_REASONS: ReadonlySet<V8ReasonCode> = new Set([
  "source_refs_unresolved",
  "proposal_missing_source_refs",
  "judgment_missing_source_refs",
  "quiet_redaction_blocked",
  "dream_blocked_redaction",
  "dream_blocked_no_content",
  "dream_blocked_private_redacted",
  "dream_blocked_credential",
  "dream_blocked_validation_failed",
  "dream_interval_active",
]);

const UNSAFE_REASONS: ReadonlySet<V8ReasonCode> = new Set([
  "policy_denied_high_risk",
  "policy_denied_breaker_open",
]);

const PARTIAL_REASONS: ReadonlySet<V8ReasonCode> = new Set([
  "evidence_batch_truncated",
  "perception_rules_only",
  "dream_rules_only",
  "dream_model_timeout",
  "quiet_validation_failed",
  "closure_downgraded_without_draft",
]);

const UNAVAILABLE_REASONS: ReadonlySet<V8ReasonCode> = new Set([
  "state_unreadable",
  "quiet_state_unreadable",
  "ingestion_state_unreadable",
  "stage_event_missing",
  "execution_unavailable",
  "guidance_unavailable",
  "dream_scheduler_unavailable",
  "policy_denied_missing_permission",
  "closure_failed",
]);

export function classifyDegradedStatus(
  reason: V8ReasonCode,
): PreciseDegradedStatus {
  if (EMPTY_REASONS.has(reason)) return "empty";
  if (BLOCKED_REASONS.has(reason)) return "blocked";
  if (UNSAFE_REASONS.has(reason)) return "unsafe";
  if (PARTIAL_REASONS.has(reason)) return "partial";
  return "unavailable";
}
