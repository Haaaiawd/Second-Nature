import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
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
    data: { carrier: { serviceStatus: string } };
  };
  const toolPayload = JSON.parse((await tool.execute("1", { command: "status" })).content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { carrier: { serviceStatus: string } };
  };

  assert.equal(commandPayload.ok, false);
  assert.equal(toolPayload.ok, false);
  assert.equal(commandPayload.data.carrier.serviceStatus, toolPayload.data.carrier.serviceStatus);
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

  const commandPayload = JSON.parse(commandResult.text) as { ok: boolean; data: { carrier: { serviceStatus: string } } };
  const toolPayload = JSON.parse(toolResult.content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { carrier: { serviceStatus: string } };
  };

  assert.equal(commandPayload.ok, false);
  assert.equal(toolPayload.ok, false);
  assert.equal(commandPayload.data.carrier.serviceStatus, toolPayload.data.carrier.serviceStatus);
});


test("T1.2.3 heartbeat_check is exposed on command/tool surfaces with consumable parity", async () => {
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

  const commandResult = await command.handler({ args: "heartbeat_check 2026-04-27T10:00:00Z host-context" });
  const toolResult = await tool.execute("1", {
    command: "heartbeat_check",
    args: {
      timestamp: "2026-04-27T10:00:00Z",
      sessionContext: "host-context",
      heartbeatChecklist: "call second_nature_ops heartbeat_check",
    },
  });

  const commandPayload = JSON.parse(commandResult.text) as {
    ok: boolean;
    status: string;
    surfaceMode: string;
    livedExperienceLoopClaimed?: boolean;
    nextAction: string;
    data: {
      surface: { tool: string; command: string };
      bridge: {
        timestamp: string;
        sessionContextProvided: boolean;
        heartbeatChecklistProvided: boolean;
        serviceEntryMode: string;
      };
    };
  };
  const toolPayload = JSON.parse(toolResult.content[0]?.text ?? "{}") as typeof commandPayload;

  assert.equal(commandPayload.ok, true);
  assert.equal(commandPayload.status, "runtime_carrier_only");
  assert.equal(commandPayload.surfaceMode, "host_safe_carrier");
  assert.equal(commandPayload.livedExperienceLoopClaimed, false);
  assert.equal(commandPayload.nextAction, "continue_carrier_surface_only");
  assert.equal(commandPayload.data.surface.tool, "second_nature_ops");
  assert.equal(commandPayload.data.surface.command, "second-nature heartbeat_check");
  assert.equal(commandPayload.data.bridge.timestamp, "2026-04-27T10:00:00Z");
  assert.equal(commandPayload.data.bridge.sessionContextProvided, true);
  assert.equal(commandPayload.data.bridge.heartbeatChecklistProvided, false);
  assert.equal(commandPayload.data.bridge.serviceEntryMode, "runtime_carrier_only");

  assert.equal(toolPayload.ok, true);
  assert.equal(toolPayload.status, "runtime_carrier_only");
  assert.equal(toolPayload.surfaceMode, "host_safe_carrier");
  assert.equal(toolPayload.livedExperienceLoopClaimed, false);
  assert.equal(toolPayload.nextAction, "continue_carrier_surface_only");
  assert.equal(toolPayload.data.surface.tool, commandPayload.data.surface.tool);
  assert.equal(toolPayload.data.surface.command, commandPayload.data.surface.command);
  assert.equal(toolPayload.data.bridge.timestamp, commandPayload.data.bridge.timestamp);
  assert.equal(toolPayload.data.bridge.sessionContextProvided, commandPayload.data.bridge.sessionContextProvided);
  assert.equal(toolPayload.data.bridge.heartbeatChecklistProvided, true);
  assert.equal(toolPayload.data.bridge.serviceEntryMode, commandPayload.data.bridge.serviceEntryMode);
});

test("T1.2.3 carrier heartbeat_check honors probeOnly via tool (capability_probe)", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;
  const plugin = await loadPlugin();
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
    registerCommand() {},
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(tool);
  const toolResult = await tool.execute("1", {
    command: "heartbeat_check",
    args: { probeOnly: true, timestamp: "2026-04-28T10:00:00.000Z" },
  });
  const payload = JSON.parse(toolResult.content[0]?.text ?? "{}") as {
    ok: boolean;
    status: string;
    surfaceMode: string;
    reasons: string[];
    livedExperienceLoopClaimed?: boolean;
    data?: { bridge?: { serviceEntryMode?: string } };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "heartbeat_ok");
  assert.equal(payload.surfaceMode, "capability_probe");
  assert.equal(payload.livedExperienceLoopClaimed, false);
  assert.ok(payload.reasons.includes("probe_only"));
  assert.equal(payload.data?.bridge?.serviceEntryMode, "capability_probe");
});

test("T1.4.3 setup_hint returns packaged SKILL and inner guide", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;
  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: {
            command: string;
            args?: Record<string, unknown>;
            workspaceRoot?: string;
          },
        ) => Promise<{ content: Array<{ type: string; text: string }> }>;
      }
    | undefined;

  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(tool);

  const result = await tool.execute("1", {
    command: "setup_hint",
    args: { format: "full" },
  });
  const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
    ok: boolean;
    command: string;
    data?: {
      status?: string;
      skill?: { path?: string; content?: string };
      guide?: { path?: string; content?: string };
    };
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.command, "setup_hint");
  assert.equal(payload.data?.status, "workspace_root_unknown");
  assert.equal(payload.data?.skill?.path, "SKILL.md");
  assert.equal(payload.data?.guide?.path, "agent-inner-guide.md");
  assert.equal(payload.data?.skill?.content?.includes("Second Nature"), true);
  assert.equal(
    payload.data?.guide?.content?.includes("这是一封给 Claw 的便条"),
    true,
  );
});

test("T1.4.3 setup nudge is one-shot and setup_ack persists marker", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;
  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: {
            command: string;
            args?: Record<string, unknown>;
            workspaceRoot?: string;
          },
        ) => Promise<{ content: Array<{ type: string; text: string }> }>;
      }
    | undefined;

  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(tool);
  const workspaceRoot = fs.mkdtempSync(
    path.join(process.cwd(), "tmp-setup-nudge-"),
  );

  try {
    const before = JSON.parse(
      (
        await tool.execute("1", {
          command: "credential",
          args: { action: "verify" },
          workspaceRoot,
        })
      ).content[0]?.text ?? "{}",
    ) as { setupNudge?: { status?: string; command?: string } };
    assert.equal(before.setupNudge?.status, "pending");
    assert.equal(before.setupNudge?.command, "setup_hint");

    const ack = JSON.parse(
      (
        await tool.execute("1", {
          command: "setup_ack",
          args: {
            acceptedBy: "agent",
            placedIn: "workspace/IDENTITY.md",
          },
          workspaceRoot,
        })
      ).content[0]?.text ?? "{}",
    ) as { ok: boolean; data?: { markerPath?: string; placedIn?: string } };
    assert.equal(ack.ok, true);
    assert.equal(ack.data?.placedIn, "workspace/IDENTITY.md");
    assert.equal(fs.existsSync(ack.data?.markerPath ?? ""), true);

    const after = JSON.parse(
      (
        await tool.execute("1", {
          command: "credential",
          args: { action: "verify" },
          workspaceRoot,
        })
      ).content[0]?.text ?? "{}",
    ) as { setupNudge?: unknown };
    assert.equal(after.setupNudge, undefined);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("T4.1.4 second_nature_ops storage_smoke uses packaged runtime path", async () => {
  const plugin = await loadPlugin();
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
    registerCommand() {},
    registerTool(entry: unknown) {
      tool = entry as typeof tool;
    },
  });

  assert.ok(tool);

  const basic = JSON.parse((await tool.execute("1", { command: "storage_smoke", args: {} })).content[0]?.text ?? "{}") as {
    ok: boolean;
    data?: { runtimeIndexDriver?: string; semantics?: { sqlJs?: { walAssumed?: boolean } } };
  };
  assert.equal(basic.ok, true);
  assert.equal(basic.data?.runtimeIndexDriver, "sql_js");
  assert.equal(basic.data?.semantics?.sqlJs?.walAssumed, false);

  const repair = JSON.parse((await tool.execute("1", { command: "storage_smoke", args: { runRepairFixture: true } }))
    .content[0]?.text ?? "{}") as {
    ok: boolean;
    data?: { repairFromArtifactsFixture?: { repairStatus?: string } };
  };
  assert.equal(repair.ok, true);
  assert.equal(repair.data?.repairFromArtifactsFixture?.repairStatus, "ok");
});

test("T1.2.3 HEARTBEAT.md instructs tool use and carrier vs workspace semantics", () => {
  const heartbeatPath = path.join(process.cwd(), "HEARTBEAT.md");
  assert.equal(fs.existsSync(heartbeatPath), true);

  const source = fs.readFileSync(heartbeatPath, "utf-8");
  assert.equal(source.includes("second_nature_ops"), true);
  assert.equal(source.includes("heartbeat_check"), true);
  assert.equal(source.includes("runtime_carrier_only"), true);
  assert.equal(source.includes("continue_carrier_surface_only"), true);
  assert.equal(source.includes("per-heartbeat callback"), true);
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

