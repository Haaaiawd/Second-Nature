import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { createCommandRouter } from "../src/cli/index.js";

const serviceShell = {
  name: "second-nature-runtime",
  description: "Background service shell for continuity orchestration.",
  start() {
    return {
      ok: true,
      status: "idle",
    };
  },
};

export default definePluginEntry({
  id: "second-nature",
  name: "Second Nature",
  description: "Registers the minimal command/tool/service shell for Second Nature.",
  register(api) {
    const router = createCommandRouter();

    api.registerService(serviceShell);

    api.registerCli({
      id: "second-nature",
      description: "Second Nature operational surface shell",
      commands: router.commands,
    });

    api.registerCommand({
      name: "second-nature",
      description: "Route Agent-facing operational commands for Second Nature.",
      execute: async (_context: unknown, input: { command: string; args?: Record<string, unknown> }) => {
        const resolved = router.resolve(input.command);
        if (!resolved) {
          return {
            ok: false,
            command: input.command,
            message: "Unknown Second Nature command.",
          };
        }

        return resolved.execute(input.args);
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
});
