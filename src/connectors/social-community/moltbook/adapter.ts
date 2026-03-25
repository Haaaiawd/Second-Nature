import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";

export interface MoltbookApiClient {
  readFeed(payload: Record<string, unknown>): Promise<unknown>;
  publishPost(payload: Record<string, unknown>): Promise<unknown>;
  replyComment(payload: Record<string, unknown>): Promise<unknown>;
}

export interface MoltbookSkillRunner {
  run(intent: string, payload: Record<string, unknown>): Promise<unknown>;
}

export function createMoltbookRunner(input: {
  apiClient: MoltbookApiClient;
  skillRunner: MoltbookSkillRunner;
}) {
  const { apiClient, skillRunner } = input;

  return {
    async run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt> {
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
      } catch (error) {
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

async function executeByChannel(
  plan: ExecutionPlan,
  payload: Record<string, unknown>,
  apiClient: MoltbookApiClient,
  skillRunner: MoltbookSkillRunner
): Promise<unknown> {
  if (plan.channel === "api_rest") {
    if (plan.intent === "feed.read") return apiClient.readFeed(payload);
    if (plan.intent === "post.publish") return apiClient.publishPost(payload);
    if (plan.intent === "comment.reply") return apiClient.replyComment(payload);
    throw { code: "protocol_mismatch", detail: `unsupported intent for moltbook api: ${plan.intent}` };
  }

  if (plan.channel === "skill" || plan.channel === "browser") {
    return skillRunner.run(plan.intent, payload);
  }

  throw { code: "protocol_mismatch", detail: `unsupported channel for moltbook: ${plan.channel}` };
}
