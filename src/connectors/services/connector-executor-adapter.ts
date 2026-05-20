/**
 * Adapter: assemble connector-system execution infrastructure into the
 * ConnectorExecutor interface consumed by EffectDispatcher.
 *
 * When credentials / base URLs are missing, returns an honest
 * terminal_failure instead of throwing so the heartbeat loop stays stable.
 */
import type {
  ConnectorExecutor,
  ConnectorResult,
  ExecutionRunner,
  ExecutionPlan,
  ConnectorRequest,
  RawAttempt,
} from "../base/contract.js";
// Re-export for downstream consumers that expect ConnectorExecutor from contract.js
export type { ConnectorExecutor } from "../base/contract.js";
import { CapabilityContractRegistry } from "../base/manifest.js";
import { ConnectorRoutePlanner } from "../base/route-planner.js";
import { ChannelHealthStore } from "../base/channel-health.js";
import { createConnectorPolicyLayer } from "../base/policy-layer.js";
import { InMemoryEffectCommitLedger } from "../base/execution-policy.js";
import { moltbookManifest } from "../social-community/moltbook/manifest.js";
import { evomapManifest } from "../agent-network/evomap/manifest.js";
import { agentWorldManifest } from "../agent-network/agent-world/manifest.js";
import { createMoltbookApiClient } from "../social-community/moltbook/api-client.js";
import { createMoltbookRunner } from "../social-community/moltbook/adapter.js";
import { createAgentWorldRunner } from "../agent-network/agent-world/adapter.js";
import { ExecutionTelemetry } from "../../observability/services/execution-telemetry.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { createCredentialVault } from "../../storage/services/credential-vault.js";
import { createCredentialRouteContextPort } from "./credential-route-context.js";

export interface ConnectorExecutorAdapterOptions {
  stateDb: StateDatabase;
  observabilityDb: ObservabilityDatabase;
}

const DEFAULT_AGENT_WORLD_USERNAME = "nyx_ha";
const DEFAULT_AGENT_WORLD_PROFILE_PATH_TEMPLATE = "/api/agents/profile/{username}";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function resolveAgentWorldUsername(
  payload: Record<string, unknown>,
  purpose: "feed" | "discover",
): string {
  const payloadUsername =
    (purpose === "discover" ? readString(payload.targetUsername) : undefined) ??
    readString(payload.username) ??
    readString(payload.agentUsername);
  return (
    payloadUsername ??
    readString(process.env.SECOND_NATURE_AGENT_WORLD_USERNAME) ??
    DEFAULT_AGENT_WORLD_USERNAME
  );
}

function resolveAgentWorldProfilePath(
  payload: Record<string, unknown>,
  username: string,
): string {
  const template =
    readString(payload.profilePathTemplate) ??
    readString(process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE) ??
    DEFAULT_AGENT_WORLD_PROFILE_PATH_TEMPLATE;
  return template.replaceAll("{username}", encodeURIComponent(username));
}

function joinAgentWorldUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function fetchAgentWorldJson(input: {
  baseUrl: string;
  path: string;
  apiKey: string;
  method?: string;
  body?: unknown;
  label: string;
}): Promise<unknown> {
  const resp = await fetch(joinAgentWorldUrl(input.baseUrl, input.path), {
    method: input.method ?? "GET",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  if (!resp.ok) {
    throw { code: "api_error", detail: `agent-world ${input.label}: ${resp.status}` };
  }
  return resp.json();
}

function createAdaptiveExecutionRunner(
  vault: ReturnType<typeof createCredentialVault>,
): ExecutionRunner {
  return {
    async run(
      _plan: ExecutionPlan,
      request: ConnectorRequest,
    ): Promise<RawAttempt> {
      const platformId = request.platformId;
      const started = Date.now();

      const credential = await vault.loadCredentialContext(platformId);
      if (
        !credential ||
        credential.status !== "active" ||
        !credential.encryptedValue
      ) {
        return {
          platformId,
          channel: request.preferredChannel ?? "api_rest",
          latencyMs: Date.now() - started,
          success: false,
          error: {
            code: "auth_failure",
            detail: "credential_unavailable_for_execution",
          },
        };
      }

      if (platformId === "moltbook") {
        const baseUrl = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
        if (!baseUrl) {
          return {
            platformId,
            channel: request.preferredChannel ?? "api_rest",
            latencyMs: Date.now() - started,
            success: false,
            error: {
              code: "configuration_missing",
              detail: "SECOND_NATURE_MOLTBOOK_BASE_URL not set",
            },
          };
        }
        const apiClient = createMoltbookApiClient({
          baseUrl,
          accessToken: credential.encryptedValue,
          timeoutMs: 10000,
        });
        const runner = createMoltbookRunner({
          apiClient,
          skillRunner: {
            run: async () => {
              throw {
                code: "protocol_mismatch",
                detail: "moltbook_skill_runner_not_configured",
              };
            },
          },
        });
        return runner.run(_plan, request);
      }

      if (platformId === "evomap") {
        return {
          platformId,
          channel: request.preferredChannel ?? "api_rest",
          latencyMs: Date.now() - started,
          success: false,
          error: {
            code: "not_implemented",
            detail: "evomap_execution_runner_not_yet_implemented",
          },
        };
      }

      if (platformId === "agent-world") {
        const baseUrl = process.env.SECOND_NATURE_AGENT_WORLD_BASE_URL;
        if (!baseUrl) {
          return {
            platformId,
            channel: request.preferredChannel ?? "api_rest",
            latencyMs: Date.now() - started,
            success: false,
            error: {
              code: "configuration_missing",
              detail: "SECOND_NATURE_AGENT_WORLD_BASE_URL not set",
            },
          };
        }
        const runner = createAgentWorldRunner({
          apiKey: credential.encryptedValue,
          apiClient: {
            async readFeed(payload, _apiKey) {
              const username = resolveAgentWorldUsername(payload, "feed");
              return fetchAgentWorldJson({
                baseUrl,
                path: resolveAgentWorldProfilePath(payload, username),
                apiKey: _apiKey,
                label: "profile feed",
              });
            },
            async discoverWork(payload, _apiKey) {
              const username = resolveAgentWorldUsername(payload, "discover");
              return fetchAgentWorldJson({
                baseUrl,
                path: resolveAgentWorldProfilePath(payload, username),
                apiKey: _apiKey,
                label: "profile discover",
              });
            },
            async claimTask(payload, _apiKey) {
              const claimPath = readString(payload.claimEndpointPath);
              if (!claimPath) {
                throw {
                  code: "protocol_mismatch",
                  detail: "agent_world_task_claim_endpoint_not_configured",
                };
              }
              return fetchAgentWorldJson({
                baseUrl,
                path: claimPath,
                apiKey: _apiKey,
                method: "POST",
                body: payload,
                label: "task claim",
              });
            },
          },
        });
        return runner.run(_plan, request);
      }

      return {
        platformId,
        channel: request.preferredChannel ?? "api_rest",
        latencyMs: Date.now() - started,
        success: false,
        error: {
          code: "unknown_platform",
          detail: `no execution runner for ${platformId}`,
        },
      };
    },
  };
}

export function createConnectorExecutorAdapter(
  options: ConnectorExecutorAdapterOptions,
): ConnectorExecutor {
  const vault = createCredentialVault(options.stateDb.db);
  const registry = new CapabilityContractRegistry();
  registry.register({ ...moltbookManifest });
  registry.register({ ...evomapManifest });
  registry.register({ ...agentWorldManifest });

  const routeContextPort = createCredentialRouteContextPort(vault);
  const routePlanner = new ConnectorRoutePlanner(
    registry,
    routeContextPort,
    new ChannelHealthStore(),
  );
  const telemetry = new ExecutionTelemetry(options.observabilityDb);
  const executionRunner = createAdaptiveExecutionRunner(vault);

  const policy = createConnectorPolicyLayer({
    routePlanner,
    executionRunner,
    telemetry,
    effectCommitLedger: new InMemoryEffectCommitLedger(),
    retryPolicy: { maxRetries: 2, jitter: true },
  });

  return {
    async executeEffect(input): Promise<ConnectorResult<unknown>> {
      return policy.executeWithPolicy(input.intent, {
        platformId: input.platformId,
        intent: input.intent,
        payload: input.payload,
        decisionId: input.decisionId,
        intentId: input.intentId,
        idempotencyKey: input.idempotencyKey,
      });
    },
  };
}
