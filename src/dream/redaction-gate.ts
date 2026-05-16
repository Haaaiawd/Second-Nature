/**
 * Dream redaction gate.
 *
 * Core logic: before sending evidence to LLM, strip credential-like fields,
 * PII patterns, and sensitive platform payload. If redaction fails or
 * sensitivity is too high, block the LLM stage and record reason.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

const CREDENTIAL_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /cookie\s*[:=]\s*\S+/gi,
  /bearer\s+\S+/gi,
];

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card-like
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
];

export interface RedactionInput {
  evidenceSummaries: string[];
  chronicleSummaries: string[];
  activeMemorySummaries?: string[];
  sensitivityFlags?: string[];
}

export interface RedactionResult {
  allowed: boolean;
  redactedEvidence: string[];
  redactedChronicle: string[];
  redactedMemory: string[];
  blockedReason?: string;
  credentialHits: number;
  piiHits: number;
}

function redactText(text: string): {
  redacted: string;
  credentialHits: number;
  piiHits: number;
} {
  let redacted = text;
  let credentialHits = 0;
  let piiHits = 0;

  for (const pattern of CREDENTIAL_PATTERNS) {
    const matches = redacted.match(pattern);
    if (matches) {
      credentialHits += matches.length;
      redacted = redacted.replace(pattern, "[REDACTED_CREDENTIAL]");
    }
  }

  for (const pattern of PII_PATTERNS) {
    const matches = redacted.match(pattern);
    if (matches) {
      piiHits += matches.length;
      redacted = redacted.replace(pattern, "[REDACTED_PII]");
    }
  }

  return { redacted, credentialHits, piiHits };
}

export function redactDreamInput(input: RedactionInput): RedactionResult {
  let totalCredentialHits = 0;
  let totalPiiHits = 0;

  const redactList = (items: string[]): string[] =>
    items.map((item) => {
      const result = redactText(item);
      totalCredentialHits += result.credentialHits;
      totalPiiHits += result.piiHits;
      return result.redacted;
    });

  const redactedEvidence = redactList(input.evidenceSummaries);
  const redactedChronicle = redactList(input.chronicleSummaries);
  const redactedMemory = redactList(input.activeMemorySummaries ?? []);

  // If any sensitivity flag is "credential" or "sensitive", block LLM stage
  const hasHighSensitivity = (input.sensitivityFlags ?? []).some(
    (f) => f === "credential" || f === "sensitive",
  );

  if (hasHighSensitivity) {
    return {
      allowed: false,
      redactedEvidence,
      redactedChronicle,
      redactedMemory,
      blockedReason: "sensitivity_flag_blocks_llm",
      credentialHits: totalCredentialHits,
      piiHits: totalPiiHits,
    };
  }

  // If credential hits are excessive, also block
  if (totalCredentialHits > 3) {
    return {
      allowed: false,
      redactedEvidence,
      redactedChronicle,
      redactedMemory,
      blockedReason: "excessive_credential_exposure",
      credentialHits: totalCredentialHits,
      piiHits: totalPiiHits,
    };
  }

  return {
    allowed: true,
    redactedEvidence,
    redactedChronicle,
    redactedMemory,
    credentialHits: totalCredentialHits,
    piiHits: totalPiiHits,
  };
}
