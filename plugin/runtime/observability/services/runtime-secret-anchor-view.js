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
// ─── Recovery step templates ─────────────────────────────────────────────────
const RECOVERY_STEPS_MISSING = [
    {
        step: 1,
        action: "Locate your encryption key from a secure vault or backup (see AGENTS.md §Bootstrap Recovery).",
    },
    {
        step: 2,
        action: "Set the environment variable specified in keyPath to the correct key value.",
        command: "export SECOND_NATURE_ENCRYPTION_KEY=<your-key>",
    },
    {
        step: 3,
        action: "Restart the agent process or reload the workspace to pick up the new environment variable.",
    },
    {
        step: 4,
        action: "Run `self_health` to confirm the anchor status changes to verified.",
    },
];
const RECOVERY_STEPS_WRONG_KEY = [
    {
        step: 1,
        action: "The environment variable is set but the key does not match stored credentials. Retrieve the correct key from your vault.",
    },
    {
        step: 2,
        action: "Replace the current environment variable value with the correct key.",
        command: "export SECOND_NATURE_ENCRYPTION_KEY=<correct-key>",
    },
    {
        step: 3,
        action: "If the correct key is unavailable, initiate credential re-encryption with the new key (see AGENTS.md §Credential Rotation).",
    },
    {
        step: 4,
        action: "Run `self_health` to verify the anchor resolves to verified.",
    },
];
const RECOVERY_STEPS_UNAVAILABLE = [
    {
        step: 1,
        action: "The key path exists but the encryption subsystem encountered an unexpected error. Check agent logs for details.",
    },
    {
        step: 2,
        action: "Ensure no other process is locking the key file or environment context.",
    },
    {
        step: 3,
        action: "If the error persists, rotate the key following the procedure in AGENTS.md §Credential Rotation.",
    },
    {
        step: 4,
        action: "Run `self_health` after remediation to confirm resolution.",
    },
];
const RECOVERY_STEPS_VERIFIED = [];
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Probe the encryption key anchor and return a safe view.
 *
 * Guarantees:
 *   - keyPath is a path string (env var name or file path), never a value.
 *   - No field in the returned object contains the key plaintext.
 *   - recoverySteps is always populated when status ≠ "verified".
 */
export async function viewSecretAnchor(deps) {
    const now = (deps.now ?? (() => new Date().toISOString()))();
    const keyPath = deps.runtimeOpsPort.getEncryptionKeyPath();
    // Step 1: check whether the key path exists
    let keyExists;
    try {
        keyExists = await deps.runtimeOpsPort.checkKeyPathExists(keyPath);
    }
    catch {
        // checkKeyPathExists itself threw — treat as missing
        keyExists = false;
    }
    if (!keyExists) {
        return {
            anchorId: "primary",
            keyPath,
            status: "missing",
            lastCheckedAt: now,
            recoveryDocRef: "AGENTS.md#bootstrap-recovery",
            recoverySteps: RECOVERY_STEPS_MISSING,
            reasonCode: "runtime_secret_anchor_missing",
        };
    }
    // Step 2: try a sample decrypt to validate the key is correct
    let sampleResult;
    try {
        sampleResult = await deps.credentialPort.verifySampleDecrypt();
    }
    catch {
        // verifySampleDecrypt threw — key exists but subsystem is broken
        return {
            anchorId: "primary",
            keyPath,
            status: "decryption_failed",
            lastCheckedAt: now,
            recoveryDocRef: "AGENTS.md#bootstrap-recovery",
            rotationSchedule: "on workspace migration or manual rotation request",
            checkedCredentialIds: [],
            recoverySteps: RECOVERY_STEPS_UNAVAILABLE,
            reasonCode: "runtime_secret_unavailable",
        };
    }
    if (sampleResult.status === "ok") {
        return {
            anchorId: "primary",
            keyPath,
            status: "verified",
            lastCheckedAt: now,
            recoveryDocRef: "AGENTS.md#bootstrap-recovery",
            rotationSchedule: "on workspace migration or manual rotation request",
            checkedCredentialIds: sampleResult.checkedIds,
            recoverySteps: RECOVERY_STEPS_VERIFIED,
        };
    }
    if (sampleResult.status === "wrong_key") {
        return {
            anchorId: "primary",
            keyPath,
            status: "wrong_key",
            lastCheckedAt: now,
            recoveryDocRef: "AGENTS.md#bootstrap-recovery",
            rotationSchedule: "on workspace migration or manual rotation request",
            checkedCredentialIds: sampleResult.checkedIds,
            recoverySteps: RECOVERY_STEPS_WRONG_KEY,
            reasonCode: "credential_recovery_required",
        };
    }
    // sampleResult.status === "error"
    return {
        anchorId: "primary",
        keyPath,
        status: "decryption_failed",
        lastCheckedAt: now,
        recoveryDocRef: "AGENTS.md#bootstrap-recovery",
        rotationSchedule: "on workspace migration or manual rotation request",
        checkedCredentialIds: sampleResult.checkedIds,
        recoverySteps: RECOVERY_STEPS_UNAVAILABLE,
        reasonCode: "runtime_secret_unavailable",
    };
}
