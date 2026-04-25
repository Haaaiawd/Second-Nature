export function createActionBridge(stateApi) {
    return {
        async savePolicy(input) {
            await stateApi.write.savePolicy(input);
        },
        async verifyCredential(platformId, answer) {
            const existing = await stateApi.credentials.loadCredentialContext(platformId);
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
            const credentialType = existing.credentialType ?? existing.credential_type;
            const encryptedValue = existing.encryptedValue ?? existing.encrypted_value;
            const expiresAt = existing.expiresAt ?? existing.expires_at;
            const attemptsRemaining = existing.attemptsRemaining ?? existing.attempts_remaining;
            const challengeText = existing.challengeText ?? existing.challenge_text;
            await stateApi.credentials.saveCredentialContext({
                platformId: existing.platformId ?? existing.platform_id,
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
