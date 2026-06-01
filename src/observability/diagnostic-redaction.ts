/**
 * DiagnosticRedaction — Attribute sensitivity blocks and redact diagnostics.
 *
 * Core logic: Given a diagnostic payload, classify its sensitivity,
 * redact credential-shaped values, preserve public technical summaries,
 * and attribute the block to the responsible system.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md §3.4`
 * - `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v8-contracts.js` (SourceRef, RedactionClass, SensitivityClass)
 *
 * Boundary:
 * - Pure function; no DB access.
 * - Does not modify source data; returns redacted copy.
 * - Public technical vocabulary is preserved.
 *
 * Test coverage: tests/unit/observability/diagnostic-redaction.test.ts
 */

import type {
  RedactionClass,
  SensitivityClass,
  LoopStage,
  V8ReasonCode,
} from "../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface DiagnosticPayload {
  summary: string;
  detail?: string;
  sourceSystem: "perception" | "judgment" | "dream" | "policy" | "storage" | "unknown";
  sensitivityHint?: SensitivityClass;
  reasonCode?: V8ReasonCode;
}

export interface RedactedDiagnostic {
  summary: string;
  detail?: string;
  redactionClass: RedactionClass;
  attribution: string;
}

export type DiagnosticAttribution =
  | "storage_validation_block"
  | "dream_redaction_block"
  | "perception_risk_block"
  | "policy_denial"
  | "credential_shape_detected"
  | "private_context"
  | "public_technical_preserved"
  | "no_redaction_needed";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function containsCredentialValue(text: string): boolean {
  // Match both key=value and Bearer token formats
  return /\b(?:Bearer|token|secret|password|key|credential)\s*[:=\s]\s*[a-zA-Z0-9+/=_-]{8,}\b/i.test(text);
}

function containsPrivateMarker(text: string): boolean {
  return /\b(?:DM|private message|confidential|internal only)\b/i.test(text);
}

function redactCredentialValues(text: string): string {
  // Redact both key=value and Bearer token formats
  return text.replace(
    /\b((?:Bearer|token|secret|password|key|credential)\s*[:=\s]\s*)[a-zA-Z0-9+/=_-]{8,}\b/gi,
    "$1[REDACTED]",
  );
}

/**
 * Classify sensitivity-related diagnostic attribution based on source system
 * and reason code. Maps to deterministic attribution categories per
 * observability-health-system.detail.md §4.2.
 */
export function classifyDiagnosticAttribution(
  sourceSystem: DiagnosticPayload["sourceSystem"],
  reasonCode?: V8ReasonCode,
): DiagnosticAttribution {
  // Storage validation blocks
  if (sourceSystem === "storage" || reasonCode === "state_unreadable" || reasonCode === "quiet_validation_failed") {
    return "storage_validation_block";
  }

  // Dream redaction blocks
  if (sourceSystem === "dream" || reasonCode === "dream_blocked_redaction") {
    return "dream_redaction_block";
  }

  // Perception risk blocks
  if (sourceSystem === "perception" || reasonCode === "perception_rules_only" || reasonCode === "evidence_batch_truncated") {
    return "perception_risk_block";
  }

  // Policy denial
  if (sourceSystem === "policy" || reasonCode?.startsWith("policy_denied") || reasonCode === "policy_downgraded_to_draft") {
    return "policy_denial";
  }

  return "no_redaction_needed";
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function projectDiagnosticRedaction(
  payload: DiagnosticPayload,
): RedactedDiagnostic {
  const summary = payload.summary;
  const detail = payload.detail;

  // Credential value shape → blocked
  if (containsCredentialValue(summary) || (detail && containsCredentialValue(detail))) {
    return {
      summary: redactCredentialValues(summary),
      detail: detail ? redactCredentialValues(detail) : undefined,
      redactionClass: "blocked",
      attribution: `${payload.sourceSystem}:credential_shape_detected`,
    };
  }

  // Classify attribution from source system + reason code
  const attribution = classifyDiagnosticAttribution(payload.sourceSystem, payload.reasonCode);

  // Private context → redacted
  if (
    payload.sensitivityHint === "private_context" ||
    containsPrivateMarker(summary) ||
    (detail && containsPrivateMarker(detail))
  ) {
    return {
      summary: "[redacted: private context]",
      detail: undefined,
      redactionClass: "redacted",
      attribution: `${payload.sourceSystem}:${attribution}`,
    };
  }

  // Public technical → preserve with light redaction
  if (payload.sensitivityHint === "public_technical") {
    return {
      summary,
      detail,
      redactionClass: "none",
      attribution: `${payload.sourceSystem}:public_technical_preserved`,
    };
  }

  // Source-system-specific attribution for blocked/redacted cases
  if (attribution !== "no_redaction_needed") {
    const isBlocked = attribution === "policy_denial" || attribution === "dream_redaction_block";
    return {
      summary: isBlocked ? `[blocked: ${attribution.replace(/_/g, " ")}]` : summary,
      detail: isBlocked ? undefined : detail,
      redactionClass: isBlocked ? "blocked" : "redacted",
      attribution: `${payload.sourceSystem}:${attribution}`,
    };
  }

  // Default: preserve
  return {
    summary,
    detail,
    redactionClass: "none",
    attribution: `${payload.sourceSystem}:no_redaction_needed`,
  };
}
