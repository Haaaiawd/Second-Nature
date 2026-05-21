export type CredentialState = "missing" | "pending_verification" | "active" | "expired" | "revoked" | "failed" | "decrypt_failed";
export type CredentialType = "api_key" | "oauth_token" | "node_secret" | "verification_code";
export interface CredentialContext {
    platformId: string;
    status: CredentialState;
    credentialType: CredentialType;
    verificationDeadline?: string;
    attemptsRemaining?: number;
    challengeText?: string;
    verificationCode?: string;
    encryptedValue?: string;
}
export interface CredentialContextWrite {
    platformId: string;
    credentialType: CredentialType;
    encryptedValue: string;
    status: CredentialState;
    verificationCode?: string;
    challengeText?: string;
    expiresAt?: string;
    attemptsRemaining?: number;
}
