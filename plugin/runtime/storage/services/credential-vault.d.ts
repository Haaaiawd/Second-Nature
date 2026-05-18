import type { StateDatabase } from "../db/index.js";
import type { CredentialContextWrite, CredentialContext, CredentialState } from "../../shared/types/index.js";
/** Three colon-separated hex segments produced by `encryptCredentialAtRest`. */
export declare function isCredentialCiphertext(value: string): boolean;
/** Encrypts non-empty plaintext; empty string returns empty. */
export declare function encryptCredentialAtRest(plaintext: string): string;
export declare function decryptCredentialAtRest(ciphertext: string): string;
export interface CredentialVault {
    saveCredentialContext(input: CredentialContextWrite): Promise<void>;
    loadCredentialContext(platformId: string): Promise<CredentialContext | null>;
    getCredentialState(platformId: string): Promise<CredentialState>;
}
/** T1.4.1 — runtime secret health probe result for a single credential row. */
export interface CredentialHealthProbe {
    platformId: string;
    state: CredentialState | "decrypt_failed";
    keyHealth: "missing_key" | "wrong_key" | "ok";
    hasBaseUrl: boolean;
    diagnosticCode: "missing_runtime_secret" | "credential_recovery_required" | "ok";
}
/**
 * T1.4.1 — probe a credential record for runtime secret health.
 *
 * Given a raw encrypted value from the DB, this function checks:
 * 1. Is SECOND_NATURE_ENCRYPTION_KEY present and >= 32 chars?
 * 2. Can the ciphertext be decrypted with that key?
 *
 * It never throws; all failures are encoded in the returned state.
 */
export declare function probeCredentialHealth(platformId: string, encryptedValue: string | undefined | null, baseUrl: string | undefined | null): CredentialHealthProbe;
export declare function createCredentialVault(db: StateDatabase["db"]): CredentialVault;
