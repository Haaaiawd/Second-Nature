export function createInStreetRunner(input) {
    const { apiClient, credentialPort, skillRunner } = input;
    return {
        async run(plan, request) {
            const started = Date.now();
            try {
                const credential = await credentialPort.loadCredentialState(request.platformId);
                const apiKey = await ensureActiveApiKey(request.platformId, credential, credentialPort, skillRunner, plan.channel);
                const payload = await executeInStreet(plan, request.payload, apiClient, skillRunner, credential, apiKey);
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    degraded: plan.channel === "skill" || plan.channel === "browser",
                    success: true,
                    payload: {
                        capability: request.intent,
                        channel: plan.channel,
                        data: payload,
                    },
                };
            }
            catch (error) {
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    degraded: plan.channel === "skill" || plan.channel === "browser",
                    success: false,
                    error,
                };
            }
        },
    };
}
async function ensureActiveApiKey(platformId, credential, credentialPort, skillRunner, channel) {
    if (credential.status === "pending_verification") {
        if (channel !== "skill" && channel !== "browser") {
            throw { code: "verification_required", detail: "instreet verification requires skill_or_browser channel" };
        }
        const outcome = await skillRunner.resumeVerification(credential);
        await credentialPort.persistVerificationOutcome(platformId, {
            status: outcome.status,
            apiKey: outcome.apiKey,
        });
        if (outcome.status !== "active") {
            throw { code: "verification_required", detail: "instreet verification still pending" };
        }
        if (!outcome.apiKey) {
            throw { code: "auth_failure", detail: "instreet verification returned active_without_api_key" };
        }
        return outcome.apiKey;
    }
    if (credential.status !== "active" || !credential.encryptedValue) {
        throw { code: "auth_failure", detail: `instreet credential not active: ${credential.status}` };
    }
    return credential.encryptedValue;
}
async function executeInStreet(plan, payload, apiClient, skillRunner, credential, apiKey) {
    if (plan.channel !== "api_rest" && plan.channel !== "skill" && plan.channel !== "browser") {
        throw { code: "protocol_mismatch", detail: `unsupported instreet channel: ${plan.channel}` };
    }
    if (plan.channel === "skill" || plan.channel === "browser") {
        return skillRunner.run(plan.intent, payload, { credential, apiKey });
    }
    if (plan.intent === "notification.list") {
        return apiClient.listNotifications(payload, apiKey);
    }
    if (plan.intent === "message.send") {
        return apiClient.sendMessage(payload, apiKey);
    }
    if (plan.intent === "comment.reply") {
        return apiClient.replyComment(payload, apiKey);
    }
    if (plan.intent === "agent.heartbeat") {
        return apiClient.heartbeat(apiKey);
    }
    throw { code: "protocol_mismatch", detail: `unsupported instreet intent: ${plan.intent}` };
}
