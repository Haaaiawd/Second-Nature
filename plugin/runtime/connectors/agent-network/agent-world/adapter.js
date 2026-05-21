export function createAgentWorldRunner(input) {
    const { apiClient, apiKey: configuredApiKey } = input;
    return {
        async run(plan, request) {
            const started = Date.now();
            try {
                const apiKey = configuredApiKey ?? request.payload.apiKey ?? "";
                if (!apiKey) {
                    return {
                        platformId: request.platformId,
                        channel: plan.channel,
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "auth_failure",
                            detail: "api_key_required_for_agent_world",
                        },
                    };
                }
                let result;
                if (plan.intent === "feed.read") {
                    result = await apiClient.readFeed(request.payload, String(apiKey));
                }
                else if (plan.intent === "work.discover") {
                    result = await apiClient.discoverWork(request.payload, String(apiKey));
                }
                else if (plan.intent === "task.claim") {
                    result = await apiClient.claimTask(request.payload, String(apiKey));
                }
                else {
                    throw { code: "protocol_mismatch", detail: `unsupported agent-world intent: ${plan.intent}` };
                }
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    degraded: plan.channel === "skill",
                    success: true,
                    payload: {
                        capability: request.intent,
                        channel: plan.channel,
                        data: result,
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
