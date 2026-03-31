export function createMoltbookRunner(input) {
    const { apiClient, skillRunner } = input;
    return {
        async run(plan, request) {
            const started = Date.now();
            try {
                const payload = await executeByChannel(plan, request.payload, apiClient, skillRunner);
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
async function executeByChannel(plan, payload, apiClient, skillRunner) {
    if (plan.channel === "api_rest") {
        if (plan.intent === "feed.read")
            return apiClient.readFeed(payload);
        if (plan.intent === "post.publish")
            return apiClient.publishPost(payload);
        if (plan.intent === "comment.reply")
            return apiClient.replyComment(payload);
        throw { code: "protocol_mismatch", detail: `unsupported intent for moltbook api: ${plan.intent}` };
    }
    if (plan.channel === "skill" || plan.channel === "browser") {
        return skillRunner.run(plan.intent, payload);
    }
    throw { code: "protocol_mismatch", detail: `unsupported channel for moltbook: ${plan.channel}` };
}
