/**
 * Audit envelope construction + redaction for observability-system v5.
 *
 * Core logic: redact structured payloads, attach RedactionManifest (L0/L1 contract paths),
 * compute hash-chain fields for append-only ledger rows.
 *
 * Dependencies: observability redactEvent (field-level); maps to envelope redaction paths.
 *
 * Boundaries: persistence is delegated to AppendOnlyAuditStore / DB adapters.
 *
 * Test coverage: tests/unit/observability/audit-envelope.test.ts
 */
import * as crypto from "node:crypto";

import { redactEvent, type RedactionManifest as FieldRedactionManifest } from "../redaction/manifest.js";
import type { SensitivityLevel } from "../redaction/policy.js";

export type AuditPlane = "decision" | "delivery" | "source_coverage" | "governance" | "telemetry";

export type AuditEventFamily =
  | "heartbeat.decision"
  | "delivery"
  | "source_coverage"
  | "guidance.grounding"
  | "host_capability"
  | "connector.attempt"
  | "state.governance"
  | "narrative.trace"
  | "dream.trace";

export type AuditEnvelopeSensitivity = "public" | "internal" | "private" | "credential" | "sensitive";

export interface AuditRedactionManifest {
  manifestId: string;
  maskedPaths: string[];
  erasedPaths: string[];
  hashedPaths: string[];
  contentRefPaths: string[];
  sensitivity: AuditEnvelopeSensitivity;
}

export interface AuditIntegrity {
  previousHash?: string;
  recordHash: string;
  schemaVersion: "observability.v5";
}

export interface AuditEnvelope<TPayload> {
  eventId: string;
  family: AuditEventFamily;
  plane: AuditPlane;
  traceId: string;
  sequence: number;
  createdAt: string;
  payload: TPayload;
  redaction: AuditRedactionManifest;
  integrity: AuditIntegrity;
}

function fieldPathToAuditPath(field: string): string {
  if (field.startsWith("/")) {
    return field;
  }
  return `/payload/${field.replace(/\./g, "/")}`;
}

function mapSensitivity(level: SensitivityLevel): AuditEnvelopeSensitivity {
  switch (level) {
    case "public":
      return "public";
    case "internal":
      return "internal";
    case "confidential":
      return "private";
    case "restricted":
      return "sensitive";
    default:
      return "internal";
  }
}

export interface RedactAuditEventResult<TPayload> {
  payload: TPayload;
  redaction: AuditRedactionManifest;
}

/**
 * Apply field redaction rules and lift manifests to audit path vocabulary (observability-system.detail §2).
 */
export function redactAuditEvent<TPayload extends object>(payload: TPayload): RedactAuditEventResult<TPayload> {
  const { redacted, manifest } = redactEvent(payload);
  const redaction: AuditRedactionManifest = {
    manifestId: manifest.id,
    maskedPaths: manifest.maskedFields.map(fieldPathToAuditPath),
    erasedPaths: manifest.erasedFields.map(fieldPathToAuditPath),
    hashedPaths: manifest.hashedFields.map(fieldPathToAuditPath),
    contentRefPaths: [],
    sensitivity: mapSensitivity(manifest.sensitivityLevel),
  };
  return { payload: redacted, redaction };
}

export interface BuildAuditEnvelopeInput<TPayload extends object> {
  family: AuditEventFamily;
  plane: AuditPlane;
  traceId: string;
  sequence: number;
  payload: TPayload;
  previousHash?: string;
  eventId?: string;
  createdAt?: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function hashRecord(input: {
  eventId: string;
  family: AuditEventFamily;
  plane: AuditPlane;
  traceId: string;
  sequence: number;
  createdAt: string;
  payload: unknown;
  redaction: AuditRedactionManifest;
  previousHash?: string;
}): string {
  const canonical = stableStringify({
    eventId: input.eventId,
    family: input.family,
    plane: input.plane,
    traceId: input.traceId,
    sequence: input.sequence,
    createdAt: input.createdAt,
    payload: input.payload,
    redaction: input.redaction,
    previousHash: input.previousHash ?? null,
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** Recompute integrity hash for an existing envelope (T5.2.2 / verifyAuditHashChain). */
export function computeAuditRecordHash(envelope: AuditEnvelope<unknown>): string {
  return hashRecord({
    eventId: envelope.eventId,
    family: envelope.family,
    plane: envelope.plane,
    traceId: envelope.traceId,
    sequence: envelope.sequence,
    createdAt: envelope.createdAt,
    payload: envelope.payload,
    redaction: envelope.redaction,
    previousHash: envelope.integrity.previousHash,
  });
}

export function buildAuditEnvelope<TPayload extends object>(input: BuildAuditEnvelopeInput<TPayload>): AuditEnvelope<TPayload> {
  const { payload, redaction } = redactAuditEvent(input.payload);
  const eventId = input.eventId ?? crypto.randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const recordHash = hashRecord({
    eventId,
    family: input.family,
    plane: input.plane,
    traceId: input.traceId,
    sequence: input.sequence,
    createdAt,
    payload,
    redaction,
    previousHash: input.previousHash,
  });

  return {
    eventId,
    family: input.family,
    plane: input.plane,
    traceId: input.traceId,
    sequence: input.sequence,
    createdAt,
    payload,
    redaction,
    integrity: {
      previousHash: input.previousHash,
      recordHash,
      schemaVersion: "observability.v5",
    },
  };
}

/** @internal Maps legacy field manifest to audit manifest for persistence helpers. */
export function auditManifestFromFieldManifest(manifest: FieldRedactionManifest): AuditRedactionManifest {
  return {
    manifestId: manifest.id,
    maskedPaths: manifest.maskedFields.map(fieldPathToAuditPath),
    erasedPaths: manifest.erasedFields.map(fieldPathToAuditPath),
    hashedPaths: manifest.hashedFields.map(fieldPathToAuditPath),
    contentRefPaths: [],
    sensitivity: mapSensitivity(manifest.sensitivityLevel),
  };
}
