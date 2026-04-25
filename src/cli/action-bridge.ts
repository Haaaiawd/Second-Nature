import type { StateAPI } from "../storage/state-api.js";

export interface PolicyWriteInput {
  platformId: string;
  socialDailyLimit: number;
  quietEnabled: boolean;
}

export interface ActionBridge {
  savePolicy(input: PolicyWriteInput): Promise<void>;
  verifyCredential(platformId: string, answer: string): Promise<void>;
}

export function createActionBridge(stateApi: StateAPI): ActionBridge {

  return {
    async savePolicy(input: PolicyWriteInput): Promise<void> {
      await stateApi.write.savePolicy(input);
    },

    async verifyCredential(platformId: string, answer: string): Promise<void> {
      const existing = await stateApi.credentials.loadCredentialContext(platformId) as
        | {
            platformId: string;
            credentialType: string;
            encryptedValue: string;
            status: string;
            verificationCode?: string | null;
            challengeText?: string | null;
            expiresAt?: string | null;
            attemptsRemaining?: number | null;
            updatedAt?: string;
          }
        | null;
      if (!existing) {
        throw new Error("credential_context_not_found");
      }

      const isPending = existing.status === "pending_verification";
      if (!isPending) {
        throw new Error("credential_not_pending_verification");
      }

      if (!answer.trim()) {
        throw new Error("verification_answer_required");
      }

      const credentialType = (existing as unknown as { credentialType?: string }).credentialType ?? (existing as unknown as { credential_type?: string }).credential_type;
      const encryptedValue = (existing as unknown as { encryptedValue?: string }).encryptedValue ?? (existing as unknown as { encrypted_value?: string }).encrypted_value;
      const expiresAt = (existing as unknown as { expiresAt?: string | null }).expiresAt ?? (existing as unknown as { expires_at?: string | null }).expires_at;
      const attemptsRemaining = (existing as unknown as { attemptsRemaining?: number | null }).attemptsRemaining ?? (existing as unknown as { attempts_remaining?: number | null }).attempts_remaining;
      const challengeText = (existing as unknown as { challengeText?: string | null }).challengeText ?? (existing as unknown as { challenge_text?: string | null }).challenge_text;

      await stateApi.credentials.saveCredentialContext({
        platformId: (existing as unknown as { platformId: string }).platformId ?? (existing as unknown as { platform_id: string }).platform_id,
        credentialType: credentialType ?? "",
        encryptedValue: encryptedValue ?? "",
        status: "active",
        verificationCode: answer,
        challengeText,
        expiresAt,
        attemptsRemaining,
        updatedAt: new Date().toISOString(),
      });
    },
  };
}
