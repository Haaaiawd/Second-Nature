import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface ServiceRegistration {
  id: string;
  start: () => unknown;
}

interface CommandRegistration {
  name: string;
  description: string;
  acceptsArgs?: boolean;
  handler: (ctx: { args?: string }) => Promise<{ text: string }> | { text: string };
}

async function loadPlugin() {
  const pluginUrl = pathToFileURL(path.join(process.cwd(), "plugin", "index.js")).href;
  const mod = await import(pluginUrl);
  return mod.default as {
    register(api: {
      registerService(service: ServiceRegistration): void;
      registerCommand(command: CommandRegistration): void;
      registerTool(tool: unknown): void;
    }): void;
  };
}

test("T5.3.2 plugin register is synchronous and registers surfaces before returning", async () => {
  const plugin = await loadPlugin();
  const services: ServiceRegistration[] = [];
  const commands: CommandRegistration[] = [];
  const tools: unknown[] = [];

  const api = {
    registerService(service: ServiceRegistration) {
      services.push(service);
    },
    registerCommand(command: CommandRegistration) {
      commands.push(command);
    },
    registerTool(tool: unknown) {
      tools.push(tool);
    },
  };

  const result = plugin.register(api);
  assert.equal(result, undefined);
  assert.equal(services.length, 2);
  assert.equal(commands.length, 1);
  assert.equal(tools.length, 1);
  assert.deepEqual(services.map((service) => service.id).sort(), [
    "second-nature-lifecycle",
    "second-nature-runtime",
  ]);
  assert.equal(commands[0]?.name, "second-nature");
});

test("T5.3.2 register does not start services before host invokes them", async () => {
  const plugin = await loadPlugin();
  let runtimeService: ServiceRegistration | undefined;
  let lifecycleService: ServiceRegistration | undefined;
  let command: CommandRegistration | undefined;
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown> },
        ) => Promise<{ content: Array<{ type: string; text: string }> }>;
      }
    | undefined;

  plugin.register({
    registerService(service: ServiceRegistration) {
      if (service.id === "second-nature-runtime") {
        runtimeService = service;
      }
      if (service.id === "second-nature-lifecycle") {
        lifecycleService = service;
      }
    },
    registerCommand(entry: CommandRegistration) {
      command = entry;
    },
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(runtimeService);
  assert.ok(lifecycleService);
  assert.ok(command);
  assert.ok(tool);

  const lifecycleBeforeUse = lifecycleService.start() as { registerCount: number };
  assert.equal(lifecycleBeforeUse.registerCount, 0);

  const commandPayload = JSON.parse((await command.handler({ args: "status" })).text) as {
    ok: boolean;
    data: { runtime: { serviceStatus: string } };
  };
  const toolPayload = JSON.parse((await tool.execute("1", { command: "status" })).content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { runtime: { serviceStatus: string } };
  };

  assert.equal(commandPayload.ok, true);
  assert.equal(toolPayload.ok, true);
  assert.equal(commandPayload.data.runtime.serviceStatus, toolPayload.data.runtime.serviceStatus);
});


test("T5.3.2 command and tool surfaces share router semantics", async () => {
  const plugin = await loadPlugin();
  let command: CommandRegistration | undefined;
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown> },
        ) => Promise<{ content: Array<{ type: string; text: string }> }>;
      }
    | undefined;

  plugin.register({
    registerService() {},
    registerCommand(entry: CommandRegistration) {
      command = entry;
    },
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(command);
  assert.ok(tool);

  const commandResult = await command.handler({ args: "status" });
  const toolResult = await tool.execute("1", { command: "status" });

  assert.equal(typeof commandResult.text, "string");
  assert.equal(toolResult.content[0]?.type, "text");

  const commandPayload = JSON.parse(commandResult.text) as { ok: boolean; data: { runtime: { serviceStatus: string } } };
  const toolPayload = JSON.parse(toolResult.content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { runtime: { serviceStatus: string } };
  };

  assert.equal(commandPayload.ok, true);
  assert.equal(toolPayload.ok, true);
  assert.equal(commandPayload.data.runtime.serviceStatus, toolPayload.data.runtime.serviceStatus);
});

test("T5.3.2 command surface rejects structured-only actions and parses simple args", async () => {
  const plugin = await loadPlugin();
  let command: CommandRegistration | undefined;

  plugin.register({
    registerService() {},
    registerCommand(entry: CommandRegistration) {
      command = entry;
    },
    registerTool() {},
  });

  assert.ok(command);

  const policySet = JSON.parse((await command.handler({ args: "policy set instreet" })).text) as {
    ok: boolean;
    message: string;
  };
  assert.equal(policySet.ok, false);
  assert.equal(policySet.message.includes("structured args"), true);

  const sessionMissing = JSON.parse((await command.handler({ args: "session" })).text) as {
    ok: boolean;
    error?: { code?: string };
  };
  assert.equal(sessionMissing.ok, false);
  assert.equal(sessionMissing.error?.code, "MISSING_SESSION_ID");
});

