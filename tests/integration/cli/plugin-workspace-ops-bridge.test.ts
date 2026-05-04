import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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

test("T1.1.4 CH-11-02 — carrier explain (root unknown) is ok:false + EXPLAIN_READ_SURFACE_UNAVAILABLE", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;
  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown>; workspaceRoot?: string },
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
  const text = (await tool.execute("1", { command: "explain", args: { subject: "probe:ch11-02" } })).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as { ok: boolean; error?: { code?: string }; data?: { evaluated?: boolean } };
  assert.equal(payload.ok, false);
  assert.equal(payload.error?.code, "EXPLAIN_READ_SURFACE_UNAVAILABLE");
  assert.equal(payload.data?.evaluated, false);
});

test("T1.1.4 known workspaceRoot bridges heartbeat_check to workspace_full_runtime", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });

  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown>; workspaceRoot?: string },
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
  const text = (
    await tool.execute("1", {
      command: "heartbeat_check",
      args: { timestamp: "2026-05-04T12:00:00.000Z" },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    surfaceMode: string;
    status: string;
    livedExperienceLoopClaimed: boolean;
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.surfaceMode, "workspace_full_runtime");
  assert.equal(payload.livedExperienceLoopClaimed, false);
  assert.ok(payload.status !== "runtime_carrier_only");
});

test("T1.1.4 known workspaceRoot quiet/status match CLI-shaped ok:true", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-quiet-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });

  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown>; workspaceRoot?: string },
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
  const status = JSON.parse((await tool.execute("1", { command: "status", workspaceRoot: tmp })).content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { runtime: { host: string } };
  };
  assert.equal(status.ok, true);
  assert.equal(status.data.runtime.host, "openclaw-plugin");

  const quiet = JSON.parse((await tool.execute("1", { command: "quiet", workspaceRoot: tmp })).content[0]?.text ?? "{}") as {
    ok: boolean;
    data: { sourceCount: number };
  };
  assert.equal(quiet.ok, true);
  assert.equal(typeof quiet.data.sourceCount, "number");
});

test("T1.1.4 carrier-only baseline — no workspaceRoot still yields runtime_carrier_only heartbeat", async () => {
  delete process.env.SECOND_NATURE_WORKSPACE_ROOT;
  const plugin = await loadPlugin();
  let tool:
    | {
        execute: (
          _id: string,
          params: { command: string; args?: Record<string, unknown>; workspaceRoot?: string },
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
  const text = (
    await tool.execute("1", {
      command: "heartbeat_check",
      args: { timestamp: "2026-05-04T12:00:00.000Z" },
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as { ok: boolean; status: string; nextAction?: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "runtime_carrier_only");
  assert.equal(payload.nextAction, "continue_carrier_surface_only");
});
