/**
 * WriteValidationGate — T-SMS.C.1
 *
 * Core logic: All write paths MUST pass through this gate before persisting.
 * Rejects payloads containing sensitive fields, missing source refs on fact
 * claims, or failing schema/sensitivity scans. Returns structured machine-
 * readable reason codes (DR-022).
 *
 * Dependencies:
 * - `SourceRef` type from `../../shared/types/source-ref.js`
 * - v7 entity types for shape awareness
 *
 * Boundary:
 * - This gate is stateless; it inspects payloads but never writes.
 * - Callers must handle rejection before any DB/artifact write.
 * - Does NOT redact — redaction is the caller's responsibility after gate
 *   approval.
 *
 * Test coverage: tests/unit/storage/write-validation-gate.test.ts
 */
export type WriteValidationFailureReason = "write_validation_failed:credential_detected" | "write_validation_failed:token_detected" | "write_validation_failed:raw_private_content_detected" | "write_validation_failed:raw_prompt_detected" | "write_validation_failed:source_refs_missing" | "write_validation_failed:source_refs_empty" | "write_validation_failed:sensitivity_scan_failed" | "write_validation_failed:schema_validation_failed" | "write_validation_failed:encryption_key_detected" | "write_validation_failed:session_token_detected";
export interface WriteValidationResult {
    ok: boolean;
    reason?: WriteValidationFailureReason;
    details?: string;
    field?: string;
    pattern?: string;
}
export interface WriteValidationGateOptions {
    /** If true, fact-claim-like payloads require sourceRefs. Default true. */
    requireSourceRefs?: boolean;
    /** If true, run deep sensitivity scan. Default true. */
    runSensitivityScan?: boolean;
    /** If true, scan for sensitive field keys. Default true. */
    scanFieldKeys?: boolean;
}
/**
 * Validate a write payload before persistence.
 *
 * @param payload — the object about to be written
 * @param options — gate behavior tuning
 * @returns WriteValidationResult: ok=true to proceed, ok=false with reason
 */
export declare function validateWritePayload(payload: unknown, options?: WriteValidationGateOptions): WriteValidationResult;
/**
 * Convenience: assert that payload passes gate, else throw.
 */
export declare function assertWritePayload(payload: unknown, options?: WriteValidationGateOptions): void;
