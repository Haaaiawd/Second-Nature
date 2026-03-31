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
