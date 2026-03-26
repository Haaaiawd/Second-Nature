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

      await stateApi.credentials.saveCredentialContext({
        ...existing,
        status: "active",
        verificationCode: answer,
        encryptedValue: existing.encryptedValue,
        updatedAt: new Date().toISOString(),
      });
    },
  };
}
