import { CapabilityContractRegistry } from "../base/manifest.js";
import { ConnectorRoutePlanner } from "../base/route-planner.js";
import { ChannelHealthStore } from "../base/channel-health.js";
import { createConnectorPolicyLayer } from "../base/policy-layer.js";
import { InMemoryEffectCommitLedger } from "../base/execution-policy.js";
import { moltbookManifest } from "../social-community/moltbook/manifest.js";
import { instreetManifest } from "../social-community/instreet/manifest.js";
import { evomapManifest } from "../agent-network/evomap/manifest.js";
import { agentWorldManifest } from "../agent-network/agent-world/manifest.js";
import { createMoltbookApiClient } from "../social-community/moltbook/api-client.js";
import { createMoltbookRunner } from "../social-community/moltbook/adapter.js";
import { createAgentWorldRunner } from "../agent-network/agent-world/adapter.js";
import { createEvoMapRunner } from "../agent-network/evomap/adapter.js";
import { ExecutionTelemetry } from "../../observability/services/execution-telemetry.js";
import { createCredentialVault } from "../../storage/services/credential-vault.js";
import { createCredentialRouteContextPort } from "./credential-route-context.js";
import { scanConnectorManifests } from "../registry/manifest-scanner.js";
import { parseConnectorManifestV6 } from "../manifest/manifest-parser.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createConnectorCooldownPort } from "./connector-cooldown-port.js";
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
                credentialTypes: manifest.credentials
                    .filter((credential) => credential.required !== false)
                    .map((credential) => credential.type),
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
        throw { code: "api_error", status: resp.status, detail: `agent-world ${input.label}: ${resp.status}` };
    }
    return resp.json();
}
export function createEvoMapSecretPort(vault) {
    const NODE_SECRET_KEY = "evomap_node_secret";
    return {
        async loadNodeSecret(_platformId) {
            const ctx = await vault.loadCredentialContext(NODE_SECRET_KEY);
            if (!ctx || ctx.status !== "active" || !ctx.encryptedValue)
                return null;
            // CredentialVault.loadCredentialContext already decrypts at rest;
            // encryptedValue here is the plaintext.
            return ctx.encryptedValue;
        },
        async saveNodeSecret(_platformId, nodeSecret) {
            await vault.saveCredentialContext({
                platformId: NODE_SECRET_KEY,
                credentialType: "node_secret",
                encryptedValue: nodeSecret,
                status: "active",
            });
        },
    };
}
function joinEvoMapUrl(baseUrl, path) {
    if (/^https?:\/\//i.test(path))
        return path;
    return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
async function fetchEvoMapJson(input) {
    const headers = {
        "Content-Type": "application/json",
    };
    if (input.nodeSecret) {
        headers["Authorization"] = `Bearer ${input.nodeSecret}`;
    }
    const resp = await fetch(joinEvoMapUrl(input.baseUrl, input.path), {
        method: input.method ?? "GET",
        headers,
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    if (!resp.ok) {
        throw { code: "api_error", status: resp.status, detail: `evomap ${input.label}: ${resp.status}` };
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
                        // Duplicate items at payload top-level so v8 evidence normalizer
                        // can extract content-bearing evidence without re-implementing
                        // the legacy v7 nested shape.
                        items: Array.isArray(data.items) ? data.items : [],
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
            return { manifest: parsed.manifest, manifestDir: path.dirname(file.path) };
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
                    const status = resp.status;
                    const body = await resp.text().catch(() => "");
                    return {
                        platformId: request.platformId,
                        channel: plan.channel,
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "api_error",
                            status,
                            detail: `HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`,
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
/**
 * Scriptable Node Runner — workspace connector execution via dynamic ES Module import.
 *
 * Contract (runner.mjs default export):
 *   Input:  { intent: string, payload: unknown, credential?: string }
 *   Output: { success: boolean, data?: unknown, error?: { code: string, detail: string } }
 *
 * Timeout: default 10s, overridable via manifest.runner.config.timeoutMs.
 * Credential: passed as plain string when manifest.credentials required and vault has active entry.
 * Error mapping:
 *   - missing entrypoint file        → configuration_missing
 *   - default export is not function → script_error
 *   - runner throws                  → script_error (detail includes error message)
 *   - Promise.race timeout           → timeout
 */
function createScriptableNodeRunner(manifest, manifestDir, activeCredential) {
    const entryPath = manifest.runner.entrypoint ?? "runner.mjs";
    const absoluteEntryPath = path.resolve(manifestDir, entryPath);
    const DEFAULT_TIMEOUT_MS = 10000;
    const timeoutMs = typeof manifest.runner.config?.timeoutMs === "number" &&
        Number.isFinite(manifest.runner.config.timeoutMs) &&
        manifest.runner.config.timeoutMs > 0
        ? manifest.runner.config.timeoutMs
        : DEFAULT_TIMEOUT_MS;
    return {
        async run(_plan, request) {
            const started = Date.now();
            if (!fs.existsSync(absoluteEntryPath)) {
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "configuration_missing",
                        detail: `scriptable_node runner not found: ${absoluteEntryPath}`,
                    },
                };
            }
            try {
                const module = await import(pathToFileURL(absoluteEntryPath).href);
                const handler = module.default;
                if (typeof handler !== "function") {
                    return {
                        platformId: request.platformId,
                        channel: request.preferredChannel ?? "api_rest",
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "script_error",
                            detail: `scriptable_node runner must export a default function from ${absoluteEntryPath}`,
                        },
                    };
                }
                const result = await Promise.race([
                    handler({
                        intent: request.intent,
                        payload: request.payload,
                        credential: activeCredential?.encryptedValue,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("scriptable_node_timeout")), timeoutMs)),
                ]);
                if (result && typeof result === "object" && "success" in result) {
                    return {
                        platformId: request.platformId,
                        channel: request.preferredChannel ?? "api_rest",
                        latencyMs: Date.now() - started,
                        success: Boolean(result.success),
                        payload: result.success
                            ? {
                                capability: request.intent,
                                channel: request.preferredChannel ?? "api_rest",
                                data: result.data,
                            }
                            : undefined,
                        error: !result.success
                            ? {
                                code: result.error?.code ?? "script_error",
                                detail: result.error?.detail ?? "scriptable_node_runner_returned_failure",
                            }
                            : undefined,
                    };
                }
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "script_error",
                        detail: `scriptable_node runner returned invalid shape from ${absoluteEntryPath}`,
                    },
                };
            }
            catch (err) {
                const isTimeout = err instanceof Error && err.message === "scriptable_node_timeout";
                return {
                    platformId: request.platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: isTimeout ? "timeout" : "script_error",
                        detail: isTimeout
                            ? `scriptable_node runner exceeded ${timeoutMs}ms timeout`
                            : String(err),
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
            const workspaceManifestResult = findWorkspaceManifest(platformId, workspaceRoot);
            const workspaceManifest = workspaceManifestResult?.manifest;
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
                    const effectivePlan = request.intent === "feed.read" && _plan.channel !== "api_rest"
                        ? { ..._plan, channel: "api_rest", endpointMode: "rest_json", degraded: false }
                        : _plan;
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
                                    code: "configuration_missing",
                                    detail: "moltbook_skill_runner_not_configured",
                                };
                            },
                        },
                    });
                    return runner.run(effectivePlan, request);
                }
                // Mock fallback when real API is not configured
                const mockRunner = createMoltbookMockRunner(workspaceRoot);
                return mockRunner.run(_plan, request);
            }
            if (platformId === "evomap") {
                const baseUrl = process.env.SECOND_NATURE_EVOMAP_BASE_URL;
                if (!baseUrl) {
                    return {
                        platformId,
                        channel: request.preferredChannel ?? "api_rest",
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "configuration_missing",
                            detail: "SECOND_NATURE_EVOMAP_BASE_URL not set. This connector requires the evomap node base URL to be configured via environment variable.",
                        },
                    };
                }
                const secretPort = createEvoMapSecretPort(vault);
                const runner = createEvoMapRunner({
                    apiClient: {
                        async heartbeat(payload, nodeSecret) {
                            const path = readString(payload.heartbeatPath) ?? "/api/heartbeat";
                            return fetchEvoMapJson({ baseUrl, path, nodeSecret, method: "POST", body: payload, label: "heartbeat" });
                        },
                        async claimTask(payload, nodeSecret) {
                            const path = readString(payload.claimPath) ?? "/api/tasks/claim";
                            return fetchEvoMapJson({ baseUrl, path, nodeSecret, method: "POST", body: payload, label: "claim" });
                        },
                    },
                    a2aClient: {
                        async helloOrRegister(payload) {
                            const path = readString(payload.registerPath) ?? "/a2a/hello";
                            return fetchEvoMapJson({ baseUrl, path, method: "POST", body: payload, label: "register" });
                        },
                        async discoverWork(payload, nodeSecret) {
                            const path = readString(payload.discoverPath) ?? "/a2a/discover";
                            return fetchEvoMapJson({ baseUrl, path, nodeSecret, method: "POST", body: payload, label: "discover" });
                        },
                    },
                    secretPort,
                });
                return runner.run(_plan, request);
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
                            detail: "SECOND_NATURE_AGENT_WORLD_BASE_URL not set. This connector requires the agent-world node base URL to be configured via environment variable.",
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
            // T-CS.C.9: instreet is registered but requires skill/browser channel;
            // pure api_rest execution returns platform_unavailable.
            if (platformId === "instreet") {
                return {
                    platformId,
                    channel: request.preferredChannel ?? "api_rest",
                    latencyMs: Date.now() - started,
                    success: false,
                    error: {
                        code: "platform_unavailable",
                        detail: "instreet_requires_skill_browser_channel",
                    },
                };
            }
            // Wave 83: workspace declarative_http connector fallback
            if (workspaceManifest && workspaceManifest.runner.kind === "declarative_http") {
                const httpRunner = createDeclarativeHttpRunner(workspaceManifest, activeCredential);
                return httpRunner.run(_plan, request);
            }
            // Wave 90: workspace scriptable_node connector
            if (workspaceManifest && workspaceManifest.runner.kind === "scriptable_node") {
                if (!workspaceManifestResult) {
                    return {
                        platformId,
                        channel: request.preferredChannel ?? "api_rest",
                        latencyMs: Date.now() - started,
                        success: false,
                        error: {
                            code: "configuration_missing",
                            detail: "scriptable_node requires workspace manifest with manifestDir",
                        },
                    };
                }
                const scriptRunner = createScriptableNodeRunner(workspaceManifest, workspaceManifestResult.manifestDir, activeCredential);
                return scriptRunner.run(_plan, request);
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
    registry.register({ ...instreetManifest });
    registerWorkspaceManifests(registry, options.workspaceRoot);
    const cooldownPort = createConnectorCooldownPort(options.stateDb);
    const routeContextPort = createCredentialRouteContextPort(vault, options.stateDb);
    const routePlanner = new ConnectorRoutePlanner(registry, routeContextPort, new ChannelHealthStore());
    const telemetry = new ExecutionTelemetry(options.observabilityDb);
    const executionRunner = createAdaptiveExecutionRunner(vault, options.workspaceRoot);
    const policy = createConnectorPolicyLayer({
        routePlanner,
        executionRunner,
        telemetry,
        cooldownPort,
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
