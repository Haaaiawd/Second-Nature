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
import type { RuntimeOpsEnvelopeV9, EvidenceLevel, SurfaceMode, DegradedReason, RuntimeDiagnostics, SourceRef } from "../../shared/types/v9-contracts.js";
export interface DiagnosticsCollectorResult {
    redactedKeys: string[];
    credentialBlocked: boolean;
    privateContentRedacted: boolean;
    promptRedacted: boolean;
}
export declare function createDiagnosticsCollector(): {
    collect: (key: string, kind: "credential" | "private" | "prompt") => void;
    result: () => DiagnosticsCollectorResult;
};
export type SensitiveKind = "credential" | "private" | "prompt" | "none";
export declare function classifySensitiveField(key: string): SensitiveKind;
/**
 * Redact sensitive fields in a payload object.
 * - Credential values: blocked (replaced with `<redacted:credential>`)
 * - Private content: replaced with `<redacted:private>`
 * - Prompt fields: replaced with `prompt_redacted:<hash>`
 * - Returns redacted payload + diagnostics
 */
export declare function redactOpsPayload(payload: unknown, depth?: number): {
    redacted: unknown;
    diagnostics: DiagnosticsCollectorResult;
};
/**
 * Cap evidence level based on surfaceMode (truth gate).
 * - carrier mode: max carrier_ack
 * - full_runtime: max state_present (unless real_runtime/durable proof)
 * - workspace_full_runtime: no cap
 */
export declare function capEvidenceLevel(level: EvidenceLevel, surfaceMode: SurfaceMode): EvidenceLevel;
/**
 * Promote evidence level based on proof signals.
 * Monotonic — can only stay same or increase.
 */
export declare function promoteEvidence(current: EvidenceLevel, signals: {
    hasSourceRefs?: boolean;
    hasRealRuntimeProof?: boolean;
    hasDurableAudit?: boolean;
}): EvidenceLevel;
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
export declare function assembleEnvelope<T = unknown>(input: EnvelopeFactoryInput<T>): RuntimeOpsEnvelopeV9<T>;
export declare function redactOpsPayloadBatch(payloads: unknown[]): {
    redacted: unknown[];
    allRedactedKeys: string[];
};
