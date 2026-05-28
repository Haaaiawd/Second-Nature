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
import { scanConnectorManifests } from "../registry/manifest-scanner.js";
import { parseConnectorManifestV6 } from "../manifest/manifest-parser.js";
import fs from "node:fs";
import path from "node:path";
const DEFAULT_AGENT_WORLD_USERNAME = "nyx_ha";
const DEFAULT_AGENT_WORLD_PROFILE_PATH_TEMPLATE = "/api/agents/profile/{username}";
function readString(value) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function channelPriorityForRunner(manifest) {
    const declared = manifest.capabilities
        .map((capability) => capability.channel)
        .filter((channel) => channel === "api_rest" ||
        channel === "api_rpc" ||
        channel === "a2a" ||
        channel === "mcp" ||
        channel === "cli" ||
        channel === "skill" ||
        channel === "browser");
    if (declared.length > 0)
        return [...new Set(declared)];
    if (manifest.runner.kind === "declarative_a2a")
        return ["a2a"];
    if (manifest.runner.kind === "declarative_mcp")
        return ["mcp"];
    if (manifest.runner.kind === "cli_descriptor")
        return ["cli"];
    if (manifest.runner.kind === "skill")
        return ["skill"];
    if (manifest.runner.kind === "browser")
        return ["browser"];
    return ["api_rest"];
}
function registerWorkspaceManifests(registry, workspaceRoot) {
    if (!workspaceRoot)
        return;
    for (const file of scanConnectorManifests(workspaceRoot)) {
        const parsed = parseConnectorManifestV6(file.content, file.path);
        if (!parsed.ok)
            continue;
        const manifest = parsed.manifest;
        try {
            registry.register({
                platformId: manifest.platformId,
                supportedCapabilities: manifest.capabilities.map((capability) => capability.id),
                channelPriority: channelPriorityForRunner(manifest),
                credentialTypes: manifest.credentials.map((credential) => credential.type),
                sourceRefPolicy: manifest.sourceRefPolicy,
            });
        }
        catch {
            // Invalid workspace manifests remain visible through connector_status validation.
            // Execution side keeps fail-closed behavior by not registering them here.
        }
    }
}
function resolveAgentWorldUsername(payload, purpose) {
    const payloadUsername = (purpose === "discover" ? readString(payload.targetUsername) : undefined) ??
        readString(payload.username) ??
        readString(payload.agentUsername);
    return (payloadUsername ??
        readString(process.env.SECOND_NATURE_AGENT_WORLD_USERNAME) ??
        DEFAULT_AGENT_WORLD_USERNAME);
}
function resolveAgentWorldProfilePath(payload, username) {
    const template = readString(payload.profilePathTemplate) ??
        readString(process.env.SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE) ??
        DEFAULT_AGENT_WORLD_PROFILE_PATH_TEMPLATE;
    return template.replaceAll("{username}", encodeURIComponent(username));
}
function joinAgentWorldUrl(baseUrl, path) {
    if (/^https?:\/\//i.test(path))
        return path;
    return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
async function fetchAgentWorldJson(input) {
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
function createMoltbookMockRunner(workspaceRoot) {
    return {
        async run(_plan, request) {
            const started = Date.now();
            const mockPath = workspaceRoot
                ? path.join(workspaceRoot, ".second-nature", "mock", "moltbook-feed.json")
                : undefined;
            if (!mockPath || !fs.existsSync(mockPath)) {
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "configuration_missing",
                        detail: "SECOND_NATURE_MOLTBOOK_BASE_URL not set and no mock data found",
                    },
                };
            }
            try {
                const raw = fs.readFileSync(mockPath, "utf-8");
                const data = JSON.parse(raw);
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    degraded: true,
                    success: true,
                    payload: {
                        capability: request.intent,
                        channel: request.preferredChannel ?? "api_rest",
                        data: {
                            source: "mock",
                            items: Array.isArray(data.items) ? data.items : [],
                        },
                    },
                };
            }
            catch (err) {
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "mock_read_error",
                        detail: String(err),
                    },
                };
            }
        },
    };
}
function findWorkspaceManifest(platformId, workspaceRoot) {
    if (!workspaceRoot)
        return undefined;
    for (const file of scanConnectorManifests(workspaceRoot)) {
        const parsed = parseConnectorManifestV6(file.content, file.path);
        if (parsed.ok && parsed.manifest.platformId === platformId) {
            return parsed.manifest;
        }
    }
    return undefined;
}
function resolveDeclarativeHttpPath(capabilityId) {
    return `/${capabilityId.replace(/\./g, "/")}`;
}
function resolveDeclarativeHttpMethod(capabilityId) {
    const readOps = ["read", "list", "discover", "get", "heartbeat", "fetch"];
    if (readOps.some((op) => capabilityId.includes(op)))
        return "GET";
    return "POST";
}
function createDeclarativeHttpRunner(manifest, credential) {
    return {
        async run(plan, request) {
            const started = Date.now();
            const baseUrl = manifest.runner.config?.baseUrl ?? "";
            if (!baseUrl) {
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "configuration_missing",
                        detail: "runner.config.baseUrl not set for declarative_http connector",
                    },
                };
            }
            const httpPath = resolveDeclarativeHttpPath(request.intent);
            const method = resolveDeclarativeHttpMethod(request.intent);
            try {
                const headers = {
                    "Content-Type": "application/json",
                };
                if (credential?.encryptedValue) {
                    headers.Authorization = `Bearer ${credential.encryptedValue}`;
                }
                const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}${httpPath}`, {
                    method,
                    headers,
                    body: method !== "GET" && request.payload ? JSON.stringify(request.payload) : undefined,
                });
                if (!resp.ok) {
                    return {
                        platformId: request.platformId,
                        channel: plan.channel,
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "api_error",
                            detail: `HTTP ${resp.status}: ${await resp.text().catch(() => "")}`,
                        },
                    };
                }
                const data = await resp.json();
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    success: true,
                    payload: {
                        capability: request.intent,
                        channel: plan.channel,
                        data,
                    },
                };
            }
            catch (err) {
                return {
                    platformId: request.platformId,
                    channel: plan.channel,
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "network_error",
                        detail: String(err),
                    },
                };
            }
        },
    };
}
function createAdaptiveExecutionRunner(vault, workspaceRoot) {
    return {
        async run(_plan, request) {
            const platformId = request.platformId;
            const started = Date.now();
            const workspaceManifest = findWorkspaceManifest(platformId, workspaceRoot);
            const isBuiltInPlatform = platformId === "moltbook" ||
                platformId === "evomap" ||
                platformId === "agent-world";
            const requiresCredential = isBuiltInPlatform ||
                Boolean(workspaceManifest?.credentials.some((credential) => credential.required !== false));
            const credential = requiresCredential
                ? await vault.loadCredentialContext(platformId)
                : undefined;
            if (requiresCredential &&
                (!credential ||
                    credential.status !== "active" ||
                    !credential.encryptedValue)) {
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
            const activeCredential = credential?.status === "active" && credential.encryptedValue
                ? { encryptedValue: credential.encryptedValue }
                : undefined;
            if (platformId === "moltbook") {
                const baseUrl = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
                if (baseUrl) {
                    const apiClient = createMoltbookApiClient({
                        baseUrl,
                        accessToken: activeCredential.encryptedValue,
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
                // Mock fallback when real API is not configured
                const mockRunner = createMoltbookMockRunner(workspaceRoot);
                return mockRunner.run(_plan, request);
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
                    apiKey: activeCredential.encryptedValue,
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
            // Wave 83: workspace declarative_http connector fallback
            if (workspaceManifest && workspaceManifest.runner.kind === "declarative_http") {
                const httpRunner = createDeclarativeHttpRunner(workspaceManifest, activeCredential);
                return httpRunner.run(_plan, request);
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
    registerWorkspaceManifests(registry, options.workspaceRoot);
    const routeContextPort = createCredentialRouteContextPort(vault);
    const routePlanner = new ConnectorRoutePlanner(registry, routeContextPort, new ChannelHealthStore());
    const telemetry = new ExecutionTelemetry(options.observabilityDb);
    const executionRunner = createAdaptiveExecutionRunner(vault, options.workspaceRoot);
    const policy = createConnectorPolicyLayer({
        routePlanner,
        executionRunner,
        telemetry,
        effectCommitLedger: new InMemoryEffectCommitLedger(),
        retryPolicy: { maxRetries: 2, jitter: true },
    });
    return {
        async executeEffect(input) {
            registerWorkspaceManifests(registry, options.workspaceRoot);
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
