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
import { createCredentialVault } from "../../storage/services/credential-vault.js";
import { createCredentialRouteContextPort } from "./credential-route-context.js";
function createAdaptiveExecutionRunner(vault) {
    return {
        async run(_plan, request) {
            const platformId = request.platformId;
            const started = Date.now();
            const credential = await vault.loadCredentialContext(platformId);
            if (!credential ||
                credential.status !== "active" ||
                !credential.encryptedValue) {
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
                    apiClient: {
                        async readFeed(payload, _apiKey) {
                            const resp = await fetch(`${baseUrl}/api/v1/feed`, {
                                headers: { "Authorization": `Bearer ${_apiKey}`, "Content-Type": "application/json" },
                            });
                            if (!resp.ok)
                                throw { code: "api_error", detail: `agent-world feed: ${resp.status}` };
                            return resp.json();
                        },
                        async discoverWork(payload, _apiKey) {
                            const resp = await fetch(`${baseUrl}/api/v1/work`, {
                                headers: { "Authorization": `Bearer ${_apiKey}`, "Content-Type": "application/json" },
                            });
                            if (!resp.ok)
                                throw { code: "api_error", detail: `agent-world work: ${resp.status}` };
                            return resp.json();
                        },
                        async claimTask(payload, _apiKey) {
                            const resp = await fetch(`${baseUrl}/api/v1/tasks/${payload.taskId ?? "unknown"}/claim`, {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${_apiKey}`, "Content-Type": "application/json" },
                                body: JSON.stringify(payload),
                            });
                            if (!resp.ok)
                                throw { code: "api_error", detail: `agent-world claim: ${resp.status}` };
                            return resp.json();
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
export function createConnectorExecutorAdapter(options) {
    const vault = createCredentialVault(options.stateDb.db);
    const registry = new CapabilityContractRegistry();
    registry.register({ ...moltbookManifest });
    registry.register({ ...evomapManifest });
    registry.register({ ...agentWorldManifest });
    const routeContextPort = createCredentialRouteContextPort(vault);
    const routePlanner = new ConnectorRoutePlanner(registry, routeContextPort, new ChannelHealthStore());
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
        async executeEffect(input) {
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
