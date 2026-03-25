import type { ConnectorRequest, ExecutionPlan, RawAttempt } from "../../base/contract.js";

export interface EvoMapApiClient {
  heartbeat(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
  claimTask(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
}

export interface EvoMapA2AClient {
  helloOrRegister(payload: Record<string, unknown>): Promise<{ your_node_id: string; node_secret: string }>;
  discoverWork(payload: Record<string, unknown>, nodeSecret: string): Promise<unknown>;
}

export interface EvoMapSecretPort {
  loadNodeSecret(platformId: string): Promise<string | null>;
  saveNodeSecret(platformId: string, nodeSecret: string): Promise<void>;
}

export function createEvoMapRunner(input: {
  apiClient: EvoMapApiClient;
  a2aClient: EvoMapA2AClient;
  secretPort: EvoMapSecretPort;
}) {
  const { apiClient, a2aClient, secretPort } = input;

  return {
    async run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt> {
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
      } catch (error) {
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

async function executeEvoMap(
  plan: ExecutionPlan,
  request: ConnectorRequest,
  apiClient: EvoMapApiClient,
  a2aClient: EvoMapA2AClient,
  secretPort: EvoMapSecretPort
): Promise<unknown> {
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
