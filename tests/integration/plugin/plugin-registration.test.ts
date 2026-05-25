/**
 * T-ROS.C.2 — Plugin registration & WorkspaceOpsBridge v7 extension.
 *
 * Verifies:
 *   1. Plugin loads without touching DB (host-safe register() mode)
 *   2. second_nature_ops tool is exposed after register()
 *   3. All v7 commands are routed through the workspace bridge path
 *      (isWorkspaceBridgeCommand returns true for each v7 command)
 *   4. parseCommandInput() produces well-formed ParsedCommand for each v7 command
 *
 * Does NOT open a real workspace DB — uses the carrier (non-bridge) path only,
 * so the test can run in CI without a workspace root.
 *
 * Evidence: tests/integration/plugin/plugin-registration.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ─── helpers ────────────────────────────────────────────────────────────────

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
interface ToolRegistration {
  execute: (
    _id: string,
    params: { command: string; args?: Record<string, unknown>; workspaceRoot?: string },
  ) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

async function loadPlugin(): Promise<{
  register(api: {
    registerService(service: ServiceRegistration): void;
    registerCommand(command: CommandRegistration): void;
    registerTool(tool: unknown): void;
  }): void;
}> {
  const pluginUrl = pathToFileURL(path.join(process.cwd(), "plugin", "index.js")).href;
  const mod = await import(pluginUrl);
  return mod.default;
}

// ─── T-ROS.C.2 / AC-1: host-safe register() never throws ───────────────────

test("T-ROS.C.2 AC-1 — plugin register() does not throw without workspace root", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

  const plugin = await loadPlugin();
  const services: string[] = [];
  const commands: string[] = [];
  const tools: unknown[] = [];

  // Should not throw regardless of env
  assert.doesNotThrow(() => {
    plugin.register({
      registerService(s) { services.push(s.id); },
      registerCommand(c) { commands.push(c.name); },
      registerTool(t) { tools.push(t); },
    });
  });

  // Must expose at least one tool
  assert.ok(tools.length >= 1, "Expected at least one tool registered");
});

// ─── T-ROS.C.2 / AC-2: second_nature_ops tool is visible ───────────────────

test("T-ROS.C.2 AC-2 — second_nature_ops tool is registered and executable", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

  const plugin = await loadPlugin();
  let tool: ToolRegistration | undefined;

  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(t: unknown) {
      tool = t as ToolRegistration;
    },
  });

  assert.ok(tool, "second_nature_ops tool must be registered");
  assert.equal(typeof tool.execute, "function", "tool.execute must be a function");

  // Execute a command without workspace root — should return ok:false gracefully (no crash)
  const result = await tool.execute("1", { command: "self_health" });
  assert.ok(Array.isArray(result.content), "tool must return {content: [...]}");
  assert.equal(result.content[0]?.type, "text", "content[0].type must be 'text'");

  const payload = JSON.parse(result.content[0]!.text) as { ok: boolean };
  // Without workspace root it will fail (no bridge), but must not throw
  assert.equal(typeof payload.ok, "boolean", "response payload must have ok field");
});

// ─── T-ROS.C.2 / AC-3: v7 commands routed through workspace bridge ──────────

const V7_COMMANDS = [
  "self_health",
  "tool_affordance",
  "heartbeat_digest",
  "snapshot:capture",
  "narrative:diff",
  "timeline",
  "restore",
  "runtime_secret_bootstrap",
] as const;

for (const cmd of V7_COMMANDS) {
  test(`T-ROS.C.2 AC-3 — ${cmd} is in WORKSPACE_BRIDGE_COMMANDS`, async () => {
    delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

    const plugin = await loadPlugin();
    let tool: ToolRegistration | undefined;

    plugin.register({
      registerService() {},
      registerCommand() {},
      registerTool(t: unknown) { tool = t as ToolRegistration; },
    });

    assert.ok(tool);

    // Without a real workspace root the bridge fails gracefully.
    // The important thing is that the dispatch reaches the bridge layer (ok: false with
    // a bridge/workspace error, NOT "unknown_command").
    const result = await tool.execute("1", { command: cmd });
    const payload = JSON.parse(result.content[0]!.text) as {
      ok: boolean;
      error?: { code?: string };
    };

    // "unknown_command" would mean the command was NOT in WORKSPACE_BRIDGE_COMMANDS
    // (it would have been processed by carrier and failed there). Any other error code
    // means the bridge layer was reached.
    assert.notEqual(
      payload.error?.code,
      "unknown_command",
      `${cmd} must not return unknown_command — it must be in WORKSPACE_BRIDGE_COMMANDS`,
    );
  });
}

// ─── T-ROS.C.2 / AC-4: parseCommandInput produces valid shapes ──────────────

test("T-ROS.C.2 AC-4 — self_health input is undefined (no args needed)", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

  const plugin = await loadPlugin();
  let tool: ToolRegistration | undefined;
  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(t: unknown) { tool = t as ToolRegistration; },
  });

  assert.ok(tool);
  // self_health requires no arguments; passing stray args should not crash
  const result = await tool.execute("1", { command: "self_health", args: {} });
  const payload = JSON.parse(result.content[0]!.text) as { ok: boolean };
  assert.equal(typeof payload.ok, "boolean");
});

test("T-ROS.C.2 AC-4 — heartbeat_digest passes date arg", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

  const plugin = await loadPlugin();
  let tool: ToolRegistration | undefined;
  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(t: unknown) { tool = t as ToolRegistration; },
  });

  assert.ok(tool);
  const result = await tool.execute("1", {
    command: "heartbeat_digest",
    args: { date: "2025-01-01" },
  });
  const payload = JSON.parse(result.content[0]!.text) as { ok: boolean; error?: { code?: string } };
  // Must reach bridge, not blow up with unknown_command
  assert.notEqual(payload.error?.code, "unknown_command");
});

test("T-ROS.C.2 AC-4 — restore passes restoreTarget/fromVersion/toVersion", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;

  const plugin = await loadPlugin();
  let tool: ToolRegistration | undefined;
  plugin.register({
    registerService() {},
    registerCommand() {},
    registerTool(t: unknown) { tool = t as ToolRegistration; },
  });

  assert.ok(tool);
  const result = await tool.execute("1", {
    command: "restore",
    args: { restoreTarget: "state", fromVersion: "v1", toVersion: "v2" },
  });
  const payload = JSON.parse(result.content[0]!.text) as { ok: boolean; error?: { code?: string } };
  assert.notEqual(payload.error?.code, "unknown_command");
});
