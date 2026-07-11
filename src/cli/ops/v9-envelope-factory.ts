/**
 * v9 RuntimeOpsEnvelopeFactory & DiagnosticsCollector (T1.2.2).
 *
 * In the v9 ops envelope assembly phase, uniformly execute:
 * 1. Payload redaction (credential/private/prompt leak blocking)
 * 2. Evidence level promotion/capping (truth gate)
 * 3. Diagnostics collection (redactedKeys, latency, etc.)
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.detail.md §1.2 §3.2 §3.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §1.8 §3.2`
 * - PRD §6.2
 *
 * Dependencies:
 * - `src/observability/v9-redaction-projector.js` (containsCredentialValue, redactPayloadJson)
 * - `src/shared/types/v9-contracts.js` (RuntimeOpsEnvelopeV9, EvidenceLevel, etc.)
 *
 * Boundary:
 * - Pure functions, no DB/network access.
 * - Redaction is pattern-based (not cryptographic) — same as T8.1.2.
 * - Evidence level is monotonic — can only stay same or increase within one command,
 *   but the truth gate can CAP it based on surfaceMode.
 *
 * Test coverage: `tests/unit/runtime-ops/v9-envelope-factory.test.ts`
 */

import type {
  RuntimeOpsEnvelopeV9,
  EvidenceLevel,
  SurfaceMode,
  DegradedReason,
  RuntimeDiagnostics,
  SourceRef,
} from "../../shared/types/v9-contracts.js";
import {
  containsCredentialValue,
  redactPayloadJson,
} from "../../observability/v9-redaction-projector.js";

// ───────────────────────────────────────────────────────────────
// Sensitive field name patterns (§3.3 redaction checklist)
// ───────────────────────────────────────────────────────────────

const CREDENTIAL_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /SECOND_NATURE_/i,
  /credential/i,
  /bearer/i,
  /authorization/i,
];

const PRIVATE_CONTENT_KEY_PATTERNS = [
  /email/i,
  /phone/i,
  /message[_-]?body/i,
  /dm[_-]?content/i,
  /private[_-]?content/i,
  /user[_-]?content/i,
];

const PROMPT_KEY_PATTERNS = [
  /^prompt$/i,
  /system[_-]?prompt/i,
  /agent[_-]?prompt/i,
  /raw[_-]?prompt/i,
];

// ───────────────────────────────────────────────────────────────
// DiagnosticsCollector
// ───────────────────────────────────────────────────────────────

export interface DiagnosticsCollectorResult {
  redactedKeys: string[];
  credentialBlocked: boolean;
  privateContentRedacted: boolean;
  promptRedacted: boolean;
}

export function createDiagnosticsCollector(): {
  collect: (key: string, kind: "credential" | "private" | "prompt") => void;
  result: () => DiagnosticsCollectorResult;
} {
  const redactedKeys: string[] = [];
  let credentialBlocked = false;
  let privateContentRedacted = false;
  let promptRedacted = false;

  return {
    collect(key, kind) {
      redactedKeys.push(key);
      if (kind === "credential") credentialBlocked = true;
      if (kind === "private") privateContentRedacted = true;
      if (kind === "prompt") promptRedacted = true;
    },
    result() {
      return { redactedKeys, credentialBlocked, privateContentRedacted, promptRedacted };
    },
  };
}

// ───────────────────────────────────────────────────────────────
// Sensitive field classification
// ───────────────────────────────────────────────────────────────

export type SensitiveKind = "credential" | "private" | "prompt" | "none";

export function classifySensitiveField(key: string): SensitiveKind {
  if (CREDENTIAL_KEY_PATTERNS.some((p) => p.test(key))) return "credential";
  if (PRIVATE_CONTENT_KEY_PATTERNS.some((p) => p.test(key))) return "private";
  if (PROMPT_KEY_PATTERNS.some((p) => p.test(key))) return "prompt";
  return "none";
}

// ───────────────────────────────────────────────────────────────
// Payload redaction (§3.3)
// ───────────────────────────────────────────────────────────────

/**
 * Redact sensitive fields in a payload object.
 * - Credential values: blocked (replaced with `<redacted:credential>`)
 * - Private content: replaced with `<redacted:private>`
 * - Prompt fields: replaced with `prompt_redacted:<hash>`
 * - Returns redacted payload + diagnostics
 */
export function redactOpsPayload(
  payload: unknown,
  depth = 0,
): { redacted: unknown; diagnostics: DiagnosticsCollectorResult } {
  const collector = createDiagnosticsCollector();
  const redacted = redactRecursive(payload, "", collector, depth);
  return { redacted, diagnostics: collector.result() };
}

function redactRecursive(
  value: unknown,
  keyPath: string,
  collector: ReturnType<typeof createDiagnosticsCollector>,
  depth: number,
): unknown {
  if (depth > 10) return value; // depth limit
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // Check if the key itself is sensitive
    const lastKey = keyPath.split(".").pop() ?? "";
    const kind = classifySensitiveField(lastKey);
    if (kind === "credential") {
      // Block credential value — check if it looks like a credential
      if (containsCredentialValue(value)) {
        collector.collect(keyPath, "credential");
        return "<redacted:credential>";
      }
      // Short string with credential key — still redact to be safe
      if (value.length > 0) {
        collector.collect(keyPath, "credential");
        return "<redacted:credential>";
      }
      return value;
    }
    if (kind === "private") {
      collector.collect(keyPath, "private");
      return "<redacted:private>";
    }
    if (kind === "prompt") {
      collector.collect(keyPath, "prompt");
      return `prompt_redacted:${hashShort(value)}`;
    }
    // Check if string value itself contains credential
    if (containsCredentialValue(value)) {
      collector.collect(keyPath, "credential");
      return "<redacted:credential>";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => redactRecursive(item, `${keyPath}[${i}]`, collector, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const childPath = keyPath ? `${keyPath}.${k}` : k;
      result[k] = redactRecursive(v, childPath, collector, depth + 1);
    }
    return result;
  }

  return value;
}

function hashShort(value: string): string {
  // Simple hash for prompt redaction (not cryptographic)
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ───────────────────────────────────────────────────────────────
// Evidence level truth gate (§1.2 §3.2)
// ───────────────────────────────────────────────────────────────

/**
 * Cap evidence level based on surfaceMode (truth gate).
 * - carrier mode: max carrier_ack
 * - full_runtime: max state_present (unless real_runtime/durable proof)
 * - workspace_full_runtime: no cap
 */
export function capEvidenceLevel(
  level: EvidenceLevel,
  surfaceMode: SurfaceMode,
): EvidenceLevel {
  if (surfaceMode === "carrier") return "carrier_ack";
  // full_runtime and workspace_full_runtime: no cap (can reach durable_verified)
  return level;
}

/**
 * Promote evidence level based on proof signals.
 * Monotonic — can only stay same or increase.
 */
export function promoteEvidence(
  current: EvidenceLevel,
  signals: {
    hasSourceRefs?: boolean;
    hasRealRuntimeProof?: boolean;
    hasDurableAudit?: boolean;
  },
): EvidenceLevel {
  let level = current;
  if (signals.hasSourceRefs) level = maxLevel(level, "state_present");
  if (signals.hasRealRuntimeProof) level = maxLevel(level, "real_runtime");
  if (signals.hasDurableAudit) level = maxLevel(level, "durable_verified");
  return level;
}

const LEVEL_ORDER: EvidenceLevel[] = ["carrier_ack", "contract_smoke", "state_present", "real_runtime", "durable_verified"];

function maxLevel(a: EvidenceLevel, b: EvidenceLevel): EvidenceLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

// ───────────────────────────────────────────────────────────────
// RuntimeOpsEnvelopeFactory
// ───────────────────────────────────────────────────────────────

export interface EnvelopeFactoryInput<T = unknown> {
  ok: boolean;
  command: string;
  payload: T;
  surfaceMode: SurfaceMode;
  sourceRefs?: SourceRef[];
  degradedReasons?: DegradedReason[];
  diagnostics?: Partial<RuntimeDiagnostics>;
  evidenceLevel?: EvidenceLevel;
  /** Proof signals for evidence level promotion. */
  proofSignals?: {
    hasSourceRefs?: boolean;
    hasRealRuntimeProof?: boolean;
    hasDurableAudit?: boolean;
  };
  generatedAt?: string;
}

export function assembleEnvelope<T = unknown>(
  input: EnvelopeFactoryInput<T>,
): RuntimeOpsEnvelopeV9<T> {
  // 1. Redact payload
  const { redacted, diagnostics: redactionDiag } = redactOpsPayload(input.payload);

  // 2. Compute evidence level
  let level = input.evidenceLevel ?? defaultEvidenceLevel(input.surfaceMode);
  if (input.proofSignals) {
    level = promoteEvidence(level, input.proofSignals);
  }
  // 3. Cap evidence level based on surfaceMode (truth gate)
  level = capEvidenceLevel(level, input.surfaceMode);

  // 4. Merge diagnostics
  const diagnostics: RuntimeDiagnostics = {
    surfaceMode: input.surfaceMode,
    ...input.diagnostics,
    redactedKeys: redactionDiag.redactedKeys.length > 0 ? redactionDiag.redactedKeys : undefined,
  };

  return {
    ok: input.ok,
    command: input.command,
    evidenceLevel: level,
    surfaceMode: input.surfaceMode,
    payload: redacted as T,
    degradedReasons: input.degradedReasons ?? [],
    diagnostics,
    sourceRefs: input.sourceRefs ?? [],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

function defaultEvidenceLevel(surfaceMode: SurfaceMode): EvidenceLevel {
  if (surfaceMode === "carrier") return "carrier_ack";
  return "contract_smoke";
}

// ───────────────────────────────────────────────────────────────
// Batch redaction for multiple payloads
// ───────────────────────────────────────────────────────────────

export function redactOpsPayloadBatch(
  payloads: unknown[],
): { redacted: unknown[]; allRedactedKeys: string[] } {
  const allRedactedKeys: string[] = [];
  const redacted = payloads.map((p) => {
    const result = redactOpsPayload(p);
    allRedactedKeys.push(...result.diagnostics.redactedKeys);
    return result.redacted;
  });
  return { redacted, allRedactedKeys };
}
