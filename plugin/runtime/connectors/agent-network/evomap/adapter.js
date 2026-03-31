export function createEvoMapRunner(input) {
    const { apiClient, a2aClient, secretPort } = input;
    return {
        async run(plan, request) {
            const started = Date.now();
            try {
                const payload = await executeEvoMap(plan, request, apiClient, a2aClient, secretPort);
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    degraded: plan.channel === "skill",
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
                    degraded: plan.channel === "skill",
                    success: false,
                    error,
                };
            }
        },
    };
}
async function executeEvoMap(plan, request, apiClient, a2aClient, secretPort) {
    if (plan.channel !== "api_rest" && plan.channel !== "a2a") {
        throw { code: "protocol_mismatch", detail: `unsupported evomap channel: ${plan.channel}` };
    }
    if (plan.intent === "agent.register") {
        if (plan.channel !== "a2a") {
            throw { code: "protocol_mismatch", detail: "evomap register requires a2a envelope channel" };
        }
        const registration = await a2aClient.helloOrRegister(request.payload);
        await secretPort.saveNodeSecret(request.platformId, registration.node_secret);
        return registration;
    }
    const nodeSecret = await secretPort.loadNodeSecret(request.platformId);
    if (!nodeSecret) {
        throw { code: "verification_required", detail: "node_secret_required" };
    }
    if (plan.intent === "agent.heartbeat") {
        if (plan.channel !== "api_rest") {
            throw { code: "protocol_mismatch", detail: "evomap heartbeat requires api_rest channel" };
        }
        return apiClient.heartbeat(request.payload, nodeSecret);
    }
    if (plan.intent === "work.discover") {
        if (plan.channel !== "a2a") {
            throw { code: "protocol_mismatch", detail: "evomap work.discover requires a2a envelope channel" };
        }
        return a2aClient.discoverWork(request.payload, nodeSecret);
    }
    if (plan.intent === "task.claim") {
        if (plan.channel !== "api_rest") {
            throw { code: "protocol_mismatch", detail: "evomap task.claim requires api_rest channel" };
        }
        return apiClient.claimTask(request.payload, nodeSecret);
    }
    throw { code: "protocol_mismatch", detail: `unsupported evomap intent: ${plan.intent}` };
}
