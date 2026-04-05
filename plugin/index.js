import { createRequire } from "node:module";
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
function resolveCommandRouterSafe() {
    const require = createRequire(import.meta.url);
    try {
        const mod = require("./runtime/cli/index.js");
        if (mod?.createCommandRouter) {
            return mod.createCommandRouter();
        }
    }
    catch {
        // fall through to fallback router
    }
    const commands = createFallbackCommands();
    return {
        commands,
        resolve(name) {
            return commands.find((command) => command.name === name);
        },
    };
}
function createRuntimeService() {
    const require = createRequire(import.meta.url);
    try {
        const runtimeMod = require("./runtime/core/second-nature/runtime/service-entry.js");
        if (runtimeMod?.startRuntimeService) {
            const handle = runtimeMod.startRuntimeService();
            return {
                id: "second-nature-runtime",
                start() {
                    return { ready: handle.ready, version: handle.version };
                },
            };
        }
    }
    catch {
        // fall through to minimal service shell
    }
    return {
        id: "second-nature-runtime",
        start() {
            return { ready: true, version: "0.1.4-minimal" };
        },
    };
}
function createLifecycleService() {
    const require = createRequire(import.meta.url);
    try {
        const lifecycleMod = require("./runtime/core/second-nature/runtime/lifecycle-service.js");
        if (lifecycleMod?.recordRegistration) {
            return {
                id: "second-nature-lifecycle",
                start() {
                    const state = lifecycleMod.recordRegistration();
                    return { phase: state.phase, registerCount: state.registerCount };
                },
            };
        }
    }
    catch {
        // fall through to minimal lifecycle shell
    }
    let registerCount = 0;
    return {
        id: "second-nature-lifecycle",
        start() {
            registerCount += 1;
            return { phase: registerCount === 1 ? "loading" : "reloading", registerCount };
        },
    };
}
export default {
    id: "second-nature",
    name: "Second Nature",
    description: "Registers command/tool/service surface with load-reload lifecycle semantics.",
    register(api) {
        const router = resolveCommandRouterSafe();
        const runtimeService = createRuntimeService();
        const lifecycleService = createLifecycleService();
        api.registerService(runtimeService);
        api.registerService(lifecycleService);
        api.registerCli(({ program }) => {
            void program;
        }, { commands: ["second-nature"] });
        api.registerCommand({
            name: "second-nature",
            description: "Route Agent-facing operational commands for Second Nature.",
            acceptsArgs: true,
            handler: async (ctx) => {
                const command = ctx.args?.trim();
                if (!command) {
                    return {
                        text: JSON.stringify({ ok: false, message: "Missing command argument." }),
                    };
                }
                const resolved = router.resolve(command);
                if (!resolved) {
                    return {
                        text: JSON.stringify({ ok: false, command, message: "Unknown Second Nature command." }),
                    };
                }
                const result = await resolved.execute();
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
                    args: { type: "object", additionalProperties: true }
                },
                required: ["command"]
            },
            async execute(_id, params) {
                const resolved = router.resolve(params.command);
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
