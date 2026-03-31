export async function credentialVerify(bridge, input) {
    const platformId = typeof input?.platformId === "string" ? input.platformId.trim() : "";
    const answer = typeof input?.answer === "string" ? input.answer.trim() : "";
    const requiredUserInput = [];
    if (!platformId)
        requiredUserInput.push("platform_id");
    if (!answer)
        requiredUserInput.push("verification_answer");
    if (requiredUserInput.length > 0) {
        return {
            ok: false,
            error: {
                code: "MISSING_VERIFICATION_FIELDS",
                message: "credential verify requires platform and answer",
                requiredUserInput,
                nextStep: "reinvoke_credential_verify_with_required_fields",
            },
        };
    }
    try {
        await bridge.verifyCredential(platformId, answer);
        return {
            ok: true,
            data: {
                platformId,
                verified: true,
            },
        };
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: "CREDENTIAL_VERIFY_FAILED",
                message: String(error),
                nextStep: "inspect_credential_status_then_retry_verify",
            },
        };
    }
}
