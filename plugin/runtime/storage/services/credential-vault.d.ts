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
export declare function createCredentialVault(db: StateDatabase["db"]): CredentialVault;
