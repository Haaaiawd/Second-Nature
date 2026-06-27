/**
 * CharacterRefreshInputNormalizer — Normalize raw signals into canonical
 * `CharacterRefreshInput` and reject raw private/prompt/credential payloads.
 *
 * Core logic: upstream systems provide redacted summaries and source refs.
 * This module enforces the input boundary before posture extraction.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §2.4 §3.0`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5.4`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (CharacterRefreshInput, CharacterSignal, SourceRef)
 *
 * Boundary:
 * - Rejects empty signals or missing source refs.
 * - Rejects disallowed source families.
 * - Rejects raw private/prompt/credential redaction classes.
 * - Does not generate posture text; only canonicalizes input.
 *
 * Test coverage: tests/unit/character/v9-character-refresh-input-normalizer.test.ts
 */

import type {
  CharacterRefreshInput,
  CharacterSignal,
  CharacterSignalRedactionClass,
  SourceRef,
  SourceRefFamily,
} from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface CharacterRefreshContext {
  refreshId: string;
  workspaceRoot: string;
  trigger: CharacterRefreshInput["trigger"];
  now?: string;
}

export interface CharacterFrameDeferredResult {
  kind: "deferred";
  reason:
    | "character_frame_insufficient_sources"
    | "character_refresh_input_invalid"
    | "character_refresh_input_redacted";
  sourceRefs: SourceRef[];
  violations?: string[];
}

export type CharacterRefreshInputResult =
  | CharacterRefreshInput
  | CharacterFrameDeferredResult;

// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────

export const CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES: ReadonlySet<SourceRefFamily> =
  new Set([
    "evidence",
    "action",
    "routine",
    "character",
    "dream",
    "quiet",
    "connector",
    "ledger",
  ]);

const BLOCKED_REDACTION_CLASSES: ReadonlySet<CharacterSignalRedactionClass> =
  new Set(["credential_blocked", "prompt_blocked", "private_blocked"]);

// Heuristic patterns that suggest a raw payload leaked through summary.
const RAW_PAYLOAD_PATTERNS = [
  /password\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /Bearer\s+[a-zA-Z0-9_-]+/,
  /\b(sk-|pk-|ek-|dk-)[a-zA-Z0-9]{20,}\b/,
];

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function deduplicateSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.family}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasOnlyAllowedSourceFamilies(refs: SourceRef[]): boolean {
  return refs.every((ref) => CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES.has(ref.family));
}

function hasOnlyCharacterFamilySourceRefs(signal: CharacterSignal): boolean {
  return signal.sourceRefs.length > 0 && signal.sourceRefs.every((ref) => ref.family === "character");
}

function containsOnlyCharacterLineage(signal: CharacterSignal): boolean {
  return signal.signalKind === "agent_contest" && hasOnlyCharacterFamilySourceRefs(signal);
}

function containsRawPayloadShape(summary: string): boolean {
  return RAW_PAYLOAD_PATTERNS.some((pattern) => pattern.test(summary));
}

function inferLocale(signals: CharacterSignal[]): CharacterRefreshInput["locale"] {
  const locales = new Set(signals.map((s) => s.locale));
  if (locales.size === 1) {
    const only = Array.from(locales)[0];
    if (only === "zh-CN" || only === "en") return only;
  }
  return "mixed";
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function normalizeCharacterRefreshInput(
  rawSignals: CharacterSignal[],
  context: CharacterRefreshContext,
): CharacterRefreshInputResult {
  if (!Array.isArray(rawSignals) || rawSignals.length === 0) {
    return {
      kind: "deferred",
      reason: "character_frame_insufficient_sources",
      sourceRefs: [],
    };
  }

  const sourceRefs = deduplicateSourceRefs(rawSignals.flatMap((s) => s.sourceRefs ?? []));
  if (sourceRefs.length === 0) {
    return {
      kind: "deferred",
      reason: "character_frame_insufficient_sources",
      sourceRefs: [],
    };
  }

  for (const signal of rawSignals) {
    const signalRefs = signal.sourceRefs ?? [];
    if (signalRefs.length === 0 || !hasOnlyAllowedSourceFamilies(signalRefs)) {
      return {
        kind: "deferred",
        reason: "character_refresh_input_invalid",
        sourceRefs,
      };
    }
    if (
      BLOCKED_REDACTION_CLASSES.has(signal.redactionClass) ||
      containsRawPayloadShape(signal.summary) ||
      (hasOnlyCharacterFamilySourceRefs(signal) && !containsOnlyCharacterLineage(signal))
    ) {
      return {
        kind: "deferred",
        reason: "character_refresh_input_redacted",
        sourceRefs,
      };
    }
  }

  return {
    kind: "input",
    refreshId: context.refreshId,
    workspaceRoot: context.workspaceRoot,
    locale: inferLocale(rawSignals),
    trigger: context.trigger,
    signals: rawSignals,
    sourceRefs,
    createdAt: context.now ?? new Date().toISOString(),
  };
}
