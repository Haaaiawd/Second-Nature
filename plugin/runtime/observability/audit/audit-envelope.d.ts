import { type RedactionManifest as FieldRedactionManifest } from "../redaction/manifest.js";
export type AuditPlane = "decision" | "delivery" | "source_coverage" | "governance" | "telemetry";
export type AuditEventFamily = "heartbeat.decision" | "delivery" | "source_coverage" | "guidance.grounding" | "host_capability" | "connector.attempt" | "state.governance";
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
export interface RedactAuditEventResult<TPayload> {
    payload: TPayload;
    redaction: AuditRedactionManifest;
}
/**
 * Apply field redaction rules and lift manifests to audit path vocabulary (observability-system.detail §2).
 */
export declare function redactAuditEvent<TPayload extends object>(payload: TPayload): RedactAuditEventResult<TPayload>;
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
/** Recompute integrity hash for an existing envelope (T5.2.2 / verifyAuditHashChain). */
export declare function computeAuditRecordHash(envelope: AuditEnvelope<unknown>): string;
export declare function buildAuditEnvelope<TPayload extends object>(input: BuildAuditEnvelopeInput<TPayload>): AuditEnvelope<TPayload>;
/** @internal Maps legacy field manifest to audit manifest for persistence helpers. */
export declare function auditManifestFromFieldManifest(manifest: FieldRedactionManifest): AuditRedactionManifest;
