import { createRequire } from "node:module";

interface RegisterApi {
  registerService(service: { id: string; start: () => unknown }): void;
  registerCli(registrar: (ctx: { program: unknown }) => void, options?: { commands?: string[] }): void;
  registerCommand(command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: { args?: string }) => Promise<{ text: string }> | { text: string };
  }): void;
  registerTool(tool: unknown, options?: unknown): void;
}

function createFallbackCommands(): Array<{
  name: string;
  description: string;
  execute: (input?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}> {
  const commandNames = ["status", "policy", "credential", "quiet", "report", "session", "audit", "explain"];

  return commandNames.map((name) => ({
    name,
    description: `Fallback command shell for ${name}`,
    execute: async (_input?: Record<string, unknown>) => ({
      ok: false,
      command: name,
      message: "Plugin loaded in packaging fallback mode; reinstall full workspace build for command runtime.",
    }),
  }));
}

function resolveCommandRouterSafe(): {
  commands: Array<{ name: string; description: string; execute: (input?: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
  resolve(name: string): { name: string; description: string; execute: (input?: Record<string, unknown>) => Promise<Record<string, unknown>> } | undefined;
} {
  const require = createRequire(import.meta.url);

  try {
    const mod = require("./runtime/cli/index.js") as { createCommandRouter: () => { commands: any[]; resolve: (name: string) => any } };
    if (mod?.createCommandRouter) {
      return mod.createCommandRouter();
    }
  } catch {
    // fall through to fallback router
  }

  const commands = createFallbackCommands();
  return {
    commands,
    resolve(name: string) {
      return commands.find((command) => command.name === name);
    },
  };
}

function createRuntimeService(): { id: string; start: () => unknown } {
  const require = createRequire(import.meta.url);

  try {
    const runtimeMod = require("./runtime/core/second-nature/runtime/service-entry.js") as {
      startRuntimeService: (ctx?: Record<string, unknown>) => { ready: boolean; version: string; close: () => void };
    };

    if (runtimeMod?.startRuntimeService) {
      const handle = runtimeMod.startRuntimeService();
      return {
        id: "second-nature-runtime",
        start() {
          return { ready: handle.ready, version: handle.version };
        },
      };
    }
  } catch {
    // fall through to minimal service shell
  }

  return {
    id: "second-nature-runtime",
    start() {
      return { ready: true, version: "0.1.4-minimal" };
    },
  };
}

function createLifecycleService(): { id: string; start: () => unknown } {
  const require = createRequire(import.meta.url);

  try {
    const lifecycleMod = require("./runtime/core/second-nature/runtime/lifecycle-service.js") as {
      recordRegistration: () => { registerCount: number; phase: string; lastChangedAt: number };
    };

    if (lifecycleMod?.recordRegistration) {
      return {
        id: "second-nature-lifecycle",
        start() {
          const state = lifecycleMod.recordRegistration();
          return { phase: state.phase, registerCount: state.registerCount };
        },
      };
    }
  } catch {
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
  register(api: RegisterApi) {
    const router = resolveCommandRouterSafe();
    const runtimeService = createRuntimeService();
    const lifecycleService = createLifecycleService();

    api.registerService(runtimeService);
    api.registerService(lifecycleService);

    api.registerCli(
      ({ program }) => {
        void program;
      },
      { commands: ["second-nature"] },
    );

    api.registerCommand({
      name: "second-nature",
      description: "Route Agent-facing operational commands for Second Nature.",
      acceptsArgs: true,
      handler: async (ctx: { args?: string }) => {
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
      async execute(_id: string, params: { command: string; args?: Record<string, unknown> }) {
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
