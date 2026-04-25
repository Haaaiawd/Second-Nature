// @ts-ignore packaged runtime declarations are generated under plugin/runtime
import { createCliRuntimeDeps, createCommandRouter } from "./runtime/cli/index.js";
import { DecisionLedger } from "./runtime/observability/services/decision-ledger.js";
import { ExecutionTelemetry } from "./runtime/observability/services/execution-telemetry.js";
import { startRuntimeService, } from "./runtime/core/second-nature/runtime/service-entry.js";
import { getLifecycleState, recordRegistration, } from "./runtime/core/second-nature/runtime/lifecycle-service.js";
const INTERNAL_RUNTIME_PLATFORM_ID = "second-nature-runtime";
const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
const INTERNAL_RUNTIME_CHANNEL = "plugin_host";
let activationSpine = null;
function createFallbackCommands() {
    const commandNames = ["status", "policy", "credential", "quiet", "report", "session", "audit", "explain"];
    return commandNames.map((name) => ({
        name,
        description: `Fallback command shell for ${name}`,
        execute: async (_input) => ({
            ok: false,
            command: name,
            message: "Plugin loaded in packaging fallback mode; reinstall full workspace build for command runtime.",
        }),
    }));
}
function createFallbackRouter() {
    const commands = createFallbackCommands();
    return {
        commands,
        resolve(name) {
            return commands.find((command) => command.name === name);
        },
    };
}
function ensureActivationSpine() {
    if (activationSpine) {
        return activationSpine;
    }
    try {
        const runtimeDeps = createCliRuntimeDeps();
        const router = createCommandRouter({ deps: runtimeDeps });
        activationSpine = {
            runtimeDeps,
            router,
            decisionLedger: new DecisionLedger(runtimeDeps.observabilityDb),
            executionTelemetry: new ExecutionTelemetry(runtimeDeps.observabilityDb),
            runtimeHandle: startRuntimeService({ workspaceRoot: process.cwd() }),
            lifecycleState: getLifecycleState(),
            serviceStartRecorded: false,
        };
        return activationSpine;
    }
    catch {
        activationSpine = {
            router: createFallbackRouter(),
            runtimeHandle: { ready: true, version: "0.1.7-minimal", close() { } },
            lifecycleState: getLifecycleState(),
            serviceStartRecorded: false,
        };
        return activationSpine;
    }
}
function refreshRegistrationState() {
    const spine = ensureActivationSpine();
    spine.runtimeHandle = startRuntimeService({ workspaceRoot: process.cwd() });
    spine.lifecycleState = recordRegistration();
    spine.serviceStartRecorded = false;
    recordRuntimeEvidence(spine, "register");
    return spine;
}
function recordRuntimeEvidence(spine, origin) {
    const decisionLedger = spine.decisionLedger;
    const executionTelemetry = spine.executionTelemetry;
    if (!decisionLedger || !executionTelemetry) {
        return;
    }
    if (origin === "service_start" && spine.serviceStartRecorded) {
        return;
    }
    if (origin === "service_start") {
        spine.serviceStartRecorded = true;
    }
    const now = new Date().toISOString();
    const traceId = `${INTERNAL_RUNTIME_TRACE_PREFIX}${origin}-${spine.lifecycleState.registerCount}-${Date.now()}`;
    const decisionId = `decision-${traceId}`;
    const tickId = `tick-${traceId}`;
    const intentId = `intent-${traceId}`;
    const capability = origin === "register"
        ? spine.lifecycleState.registerCount === 1
            ? "runtime.activate"
            : "runtime.reload"
        : "runtime.heartbeat";
    void (async () => {
        await decisionLedger.recordHeartbeatDecision({
            id: decisionId,
            tickId,
            traceId,
            intentId,
            runtimeScope: "rhythm",
            triggerSource: "heartbeat_bridge",
            decisionStatus: "heartbeat_ok",
            reasons: [
                `origin:${origin}`,
                `phase:${spine.lifecycleState.phase}`,
                `registrations:${spine.lifecycleState.registerCount}`,
            ],
            mode: "active",
            createdAt: now,
        });
        await executionTelemetry.startAttempt({
            traceId,
            decisionId,
            intentId,
            platformId: INTERNAL_RUNTIME_PLATFORM_ID,
            capability,
            channel: INTERNAL_RUNTIME_CHANNEL,
            status: "started",
            startedAt: now,
        });
        await executionTelemetry.completeAttempt(traceId, "succeeded", "committed");
    })().catch(() => {
        if (origin === "service_start") {
            spine.serviceStartRecorded = false;
        }
    });
}
function parseCommandInput(rawArgs) {
    const tokens = rawArgs?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (tokens.length === 0) {
        return {
            ok: false,
            result: { ok: false, message: "Missing command argument." },
        };
    }
    const [command, ...rest] = tokens;
    if (command === "policy" && rest[0] === "set") {
        return {
            ok: false,
            result: {
                ok: false,
                command,
                message: "policy set requires structured args; use second_nature_ops instead.",
            },
        };
    }
    if (command === "credential" && rest[0] === "verify") {
        return {
            ok: false,
            result: {
                ok: false,
                command,
                message: "credential verify requires structured args; use second_nature_ops instead.",
            },
        };
    }
    switch (command) {
        case "status":
        case "quiet":
            return {
                ok: true,
                command,
                input: rest.length > 0 ? { scope: rest.join(" ") } : undefined,
            };
        case "report":
            return {
                ok: true,
                command,
                input: rest[0] ? { day: rest[0] } : undefined,
            };
        case "session":
            return {
                ok: true,
                command,
                input: rest[0] ? { sessionId: rest[0] } : undefined,
            };
        case "credential":
            return {
                ok: true,
                command,
                input: rest[0] ? { platformId: rest[0] } : undefined,
            };
        case "explain":
            return {
                ok: true,
                command,
                input: rest.length > 0 ? { subject: rest.join(" ") } : undefined,
            };
        default:
            return {
                ok: true,
                command,
                input: undefined,
            };
    }
}
function createRuntimeService() {
    return {
        id: "second-nature-runtime",
        start() {
            const spine = ensureActivationSpine();
            recordRuntimeEvidence(spine, "service_start");
            return {
                ready: spine.runtimeHandle.ready,
                version: spine.runtimeHandle.version,
            };
        },
    };
}
function createLifecycleService() {
    return {
        id: "second-nature-lifecycle",
        start() {
            const spine = ensureActivationSpine();
            return {
                phase: spine.lifecycleState.phase,
                registerCount: spine.lifecycleState.registerCount,
                lastChangedAt: spine.lifecycleState.lastChangedAt,
            };
        },
    };
}
export default {
    id: "second-nature",
    name: "Second Nature",
    description: "Registers command/tool/service surface with load-reload lifecycle semantics.",
    register(api) {
        const spine = refreshRegistrationState();
        const runtimeService = createRuntimeService();
        const lifecycleService = createLifecycleService();
        api.registerService(runtimeService);
        api.registerService(lifecycleService);
        api.registerCommand({
            name: "second-nature",
            description: "Route Agent-facing operational commands for Second Nature.",
            acceptsArgs: true,
            handler: async (ctx) => {
                const parsed = parseCommandInput(ctx.args);
                if (!parsed.ok) {
                    return {
                        text: JSON.stringify(parsed.result),
                    };
                }
                const resolved = spine.router.resolve(parsed.command);
                if (!resolved) {
                    return {
                        text: JSON.stringify({ ok: false, command: parsed.command, message: "Unknown Second Nature command." }),
                    };
                }
                const result = await resolved.execute(parsed.input);
                return {
                    text: JSON.stringify(result),
                };
            },
        });
        api.registerTool({
            name: "second_nature_ops",
            description: "Access the Second Nature command surface through a single tool shell.",
            parameters: {
                type: "object",
                additionalProperties: false,
                properties: {
                    command: { type: "string" },
                    args: { type: "object", additionalProperties: true },
                },
                required: ["command"],
            },
            async execute(_id, params) {
                const resolved = spine.router.resolve(params.command);
                if (!resolved) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ ok: false, message: "Unknown Second Nature command." }),
                            },
                        ],
                    };
                }
                const result = await resolved.execute(params.args);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                };
            },
        });
    },
};
