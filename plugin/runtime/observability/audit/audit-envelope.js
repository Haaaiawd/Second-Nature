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
import { redactEvent } from "../redaction/manifest.js";
function fieldPathToAuditPath(field) {
    if (field.startsWith("/")) {
        return field;
    }
    return `/payload/${field.replace(/\./g, "/")}`;
}
function mapSensitivity(level) {
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
/**
 * Apply field redaction rules and lift manifests to audit path vocabulary (observability-system.detail §2).
 */
export function redactAuditEvent(payload) {
    const { redacted, manifest } = redactEvent(payload);
    const redaction = {
        manifestId: manifest.id,
        maskedPaths: manifest.maskedFields.map(fieldPathToAuditPath),
        erasedPaths: manifest.erasedFields.map(fieldPathToAuditPath),
        hashedPaths: manifest.hashedFields.map(fieldPathToAuditPath),
        contentRefPaths: [],
        sensitivity: mapSensitivity(manifest.sensitivityLevel),
    };
    return { payload: redacted, redaction };
}
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => stableStringify(v)).join(",")}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
function hashRecord(input) {
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
export function buildAuditEnvelope(input) {
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
export function auditManifestFromFieldManifest(manifest) {
    return {
        manifestId: manifest.id,
        maskedPaths: manifest.maskedFields.map(fieldPathToAuditPath),
        erasedPaths: manifest.erasedFields.map(fieldPathToAuditPath),
        hashedPaths: manifest.hashedFields.map(fieldPathToAuditPath),
        contentRefPaths: [],
        sensitivity: mapSensitivity(manifest.sensitivityLevel),
    };
}
