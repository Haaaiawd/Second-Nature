/**
 * RuntimeSecretAnchorView — T-OBS.C.7
 *
 * Core logic:
 *   viewSecretAnchor() probes the encryption key anchor and returns a
 *   RuntimeSecretAnchorView that describes the current health status.
 *
 *   Three detection scenarios (DR-034):
 *     1. Key path missing / env var not set → status "missing"
 *        reasonCode: "runtime_secret_anchor_missing"
 *     2. Key path present but sample decrypt fails with wrong-key signal
 *        reasonCode: "credential_recovery_required"
 *     3. Key path present but decrypt call throws / unrecoverable error
 *        reasonCode: "runtime_secret_unavailable"
 *
 *   RecoveryStep[] is always inline in the view (DR-034).
 *   Key plaintext is NEVER stored or returned (ADR-007).
 *   Only the key path (env var name / file path) is included.
 *
 * Test coverage: tests/unit/observability/runtime-secret-anchor-view.test.ts
 */
export type SecretAnchorStatus = "ok" | "verified" | "missing" | "wrong_key" | "decryption_failed" | "unknown";
export type HealthProbeReasonCode = "runtime_secret_unavailable" | "credential_recovery_required" | "runtime_secret_anchor_missing";
export interface RecoveryStep {
    step: number;
    action: string;
    /** Optional shell command the operator should run */
    command?: string;
}
/** The view object returned by viewSecretAnchor(). Never contains key plaintext. */
export interface RuntimeSecretAnchorView {
    anchorId: string;
    /** Env-var name or file path for the encryption key — NOT the value */
    keyPath: string;
    status: SecretAnchorStatus;
    lastCheckedAt: string;
    /** Reference to operator recovery documentation */
    recoveryDocRef: string;
    /** Optional rotation schedule hint */
    rotationSchedule?: string;
    /** IDs of credentials that were sampled during verification (not their values) */
    checkedCredentialIds?: string[];
    /** Inline recovery instructions when status is not "verified" (DR-034) */
    recoverySteps: RecoveryStep[];
    /** Machine-readable reason code when status is not "verified" */
    reasonCode?: HealthProbeReasonCode;
}
export interface SampleDecryptResult {
    /** "ok" = decrypt succeeded; "wrong_key" = key mismatch; "error" = other failure */
    status: "ok" | "wrong_key" | "error";
    checkedIds: string[];
}
export interface SecretAnchorRuntimeOpsPort {
    /** Returns the key path (env var name or file path), never the key value */
    getEncryptionKeyPath(): string;
    /** Returns true if the key path exists and is non-empty */
    checkKeyPathExists(keyPath: string): Promise<boolean>;
}
export interface SecretAnchorCredentialPort {
    /** Attempts to decrypt a known sample credential; returns status + IDs checked */
    verifySampleDecrypt(): Promise<SampleDecryptResult>;
}
export interface SecretAnchorDeps {
    runtimeOpsPort: SecretAnchorRuntimeOpsPort;
    credentialPort: SecretAnchorCredentialPort;
    /** Override for testability */
    now?: () => string;
}
/**
 * Probe the encryption key anchor and return a safe view.
 *
 * Guarantees:
 *   - keyPath is a path string (env var name or file path), never a value.
 *   - No field in the returned object contains the key plaintext.
 *   - recoverySteps is always populated when status ≠ "verified".
 */
export declare function viewSecretAnchor(deps: SecretAnchorDeps): Promise<RuntimeSecretAnchorView>;
