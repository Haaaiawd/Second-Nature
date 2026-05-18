import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeOperatorFallback } from "../../../src/storage/fallback/write-operator-fallback.js";
import { appendLifeEvidence } from "../../../src/storage/life-evidence/append-life-evidence.js";

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

test("T2.2.3 bridge full-runtime heartbeat wires connectorExecutor for connector_action", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-connector-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });

  const state = createStateDatabase(path.join(tmp, "data", "state.db"));
  await appendLifeEvidence(state, tmp, {
    id: "lev-connector-bridge",
    timestamp: "2026-05-15T05:00:00.000Z",
    evidenceType: "platform_browse",
    platformId: "moltbook",
    summary: "source-backed platform event for connector planning",
    rawContentRef: "moltbook://feed/item-1",
    sourceRefs: [
      {
        id: "src-connector-bridge",
        kind: "platform_item",
        uri: "moltbook://feed/item-1",
      },
    ],
    sensitivity: "public",
    producer: "connector-system",
  });
  state.close();

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
      args: { timestamp: "2026-05-15T05:00:00.000Z" },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    surfaceMode: string;
    status: string;
    reasons: string[];
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.surfaceMode, "workspace_full_runtime");
  assert.equal(payload.status, "intent_selected");
  assert.ok(
    payload.reasons.includes("connector_terminal_failure") ||
      payload.reasons.includes("connector_retryable_failure") ||
      payload.reasons.includes("connector_effect_executed"),
    `expected connector executor result reason, got ${JSON.stringify(payload.reasons)}`,
  );
  assert.ok(
    !payload.reasons.includes("connector_dispatch_unwired"),
    `connectorExecutor should be wired in bridge full runtime, got ${JSON.stringify(payload.reasons)}`,
  );
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
  const payload = JSON.parse(text) as { ok: boolean; status: string; surfaceMode?: string; nextAction?: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "runtime_carrier_only");
  assert.equal(payload.surfaceMode, "host_safe_carrier");
  assert.equal(payload.nextAction, "continue_carrier_surface_only");
});

test("T1.1.4 carrier heartbeat_check honors probeOnly (capability_probe, root unknown)", async () => {
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
      args: { probeOnly: true, timestamp: "2026-05-05T10:00:00.000Z" },
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    status: string;
    surfaceMode: string;
    reasons: string[];
    livedExperienceLoopClaimed?: boolean;
    nextAction?: string;
    data?: { bridge?: { serviceEntryMode?: string; probeOnly?: boolean } };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "heartbeat_ok");
  assert.equal(payload.surfaceMode, "capability_probe");
  assert.equal(payload.livedExperienceLoopClaimed, false);
  assert.ok(payload.reasons.includes("probe_only"));
  assert.equal(payload.data?.bridge?.serviceEntryMode, "capability_probe");
  assert.equal(payload.data?.bridge?.probeOnly, true);
  assert.equal(payload.nextAction, undefined);
});

test("T1.1.4 known workspace + probeOnly bridges to capability_probe", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-probe-"));
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
      args: { probeOnly: true },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as { ok: boolean; status: string; surfaceMode: string; reasons: string[] };
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "heartbeat_ok");
  assert.equal(payload.surfaceMode, "capability_probe");
  assert.ok(payload.reasons.includes("probe_only"));
});

test("T1.1.4 workspaceRoot pointing to a file fails bridge (negative)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-badroot-"));
  const bogusFile = path.join(tmp, "not-a-directory");
  fs.writeFileSync(bogusFile, "x", "utf-8");

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
      args: { timestamp: "2026-05-05T11:00:00.000Z" },
      workspaceRoot: bogusFile,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    error?: { code?: string; message?: string };
    data?: { bridgeAttempted?: boolean };
  };
  assert.equal(payload.ok, false);
  assert.equal(payload.data?.bridgeAttempted, true);
  assert.equal(payload.error?.code, "WORKSPACE_FULL_OPS_BRIDGE_FAILED");
  assert.ok(typeof payload.error?.message === "string" && payload.error.message.length > 0);
});

test("T1.1.4 CH-13-01 — bridge: fallback + report + session + credential + explain (tool workspaceRoot)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-matrix-"));
  const dataDir = path.join(tmp, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const statePath = path.join(dataDir, "state.db");
  const state = createStateDatabase(statePath);
  const { fallbackRef } = await writeOperatorFallback(state, {
    reason: "target_none",
    decisionId: "dec-ch13-matrix",
    sourceRefs: [{ id: "sr-1", kind: "decision_record", uri: "uri:ch13" }],
    candidateMessage: "redacted-ch13",
    nextStep: "next-ch13",
  });
  state.close();

  const day = "2026-05-04";
  const reportDir = path.join(tmp, "workspace", "memory", "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, `${day}.md`),
    ["# Daily Report", "", "## Summary", "CH-13 report line", "", "## Highlights", "- h1", "", "## Sources", "- s1"].join("\n"),
    "utf-8",
  );

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

  const fb = JSON.parse(
    (await tool.execute("1", { command: "fallback", args: { ref: fallbackRef }, workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { status?: string; reason?: string } };
  assert.equal(fb.ok, true);
  assert.equal(fb.data?.status, "not_sent");
  assert.equal(fb.data?.reason, "target_none");

  const rep = JSON.parse(
    (await tool.execute("1", { command: "report", args: { day }, workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { summary?: string } };
  assert.equal(rep.ok, true);
  assert.ok((rep.data?.summary ?? "").includes("CH-13"));

  const sess = JSON.parse(
    (await tool.execute("1", {
      command: "session",
      args: { sessionId: "sn-trace-ch13" },
      workspaceRoot: tmp,
    })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { requestedSessionId?: string } };
  assert.equal(sess.ok, true);
  assert.equal(sess.data?.requestedSessionId, "sn-trace-ch13");

  const cred = JSON.parse(
    (await tool.execute("1", { command: "credential", args: { platformId: "nonexistent-platform" }, workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { status?: string; platformId?: string } };
  assert.equal(cred.ok, true);
  assert.equal(cred.data?.status, "missing");
  assert.equal(cred.data?.platformId, "nonexistent-platform");

  const ex = JSON.parse(
    (await tool.execute("1", { command: "explain", args: { subject: "probe:ch13-matrix" }, workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { conclusion?: string; subjectType?: string } };
  assert.equal(ex.ok, true);
  assert.equal(ex.data?.subjectType, "probe");
  assert.ok(typeof ex.data?.conclusion === "string");
});

test("T1.1.4 v6 ops commands reachable in full runtime", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-v6-"));
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

  const narrative = JSON.parse(
    (await tool.execute("1", { command: "narrative", workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { groundingStatus?: string } };
  assert.equal(narrative.ok, true);
  assert.ok(["pass", "degraded", "blocked", "nothing_yet"].includes(narrative.data?.groundingStatus ?? ""));

  const goal = JSON.parse(
    (await tool.execute("1", { command: "goal", workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { goals?: unknown[] } };
  assert.equal(goal.ok, true);
  assert.ok(Array.isArray(goal.data?.goals));

  const dream = JSON.parse(
    (await tool.execute("1", { command: "dream:recent", workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { totalRuns?: number } };
  assert.equal(dream.ok, true);
  assert.equal(typeof dream.data?.totalRuns, "number");

  const connector = JSON.parse(
    (await tool.execute("1", { command: "connector_status", workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { connectors?: unknown[] } };
  assert.equal(connector.ok, true);
  assert.ok(Array.isArray(connector.data?.connectors));

  const cycle = JSON.parse(
    (await tool.execute("1", { command: "cycle:recent", workspaceRoot: tmp })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { totalCycles?: number } };
  assert.equal(cycle.ok, true);
  assert.equal(typeof cycle.data?.totalCycles, "number");
});

test("T1.1.4 v6 ops commands unavailable in carrier-only", async () => {
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

  const narrative = JSON.parse(
    (await tool.execute("1", { command: "narrative" })).content[0]?.text ?? "{}",
  ) as { ok: boolean; error?: { code?: string } };
  assert.equal(narrative.ok, false);
  assert.equal(narrative.error?.code, "HOST_SAFE_NARRATIVE_UNAVAILABLE");
});

test("T1.1.4 CH-13-01 — env-only SECOND_NATURE_WORKSPACE_ROOT bridges heartbeat_check (fresh process)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-env-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });

  const pluginHref = pathToFileURL(path.join(process.cwd(), "plugin", "index.js")).href;
  const runnerPath = path.join(tmp, "plugin-env-heartbeat.mjs");
  fs.writeFileSync(
    runnerPath,
    `
const pluginUrl = ${JSON.stringify(pluginHref)};
const mod = await import(pluginUrl);
let tool;
mod.default.register({
  registerService() {},
  registerCommand() {},
  registerTool(t) { tool = t; },
});
const text = (await tool.execute("1", {
  command: "heartbeat_check",
  args: { timestamp: "2026-05-04T16:00:00.000Z" },
})).content[0].text;
const p = JSON.parse(text);
if (p.surfaceMode !== "workspace_full_runtime") {
  console.error(JSON.stringify(p));
  process.exit(1);
}
process.stdout.write("ok");
`,
    "utf-8",
  );

  const result = spawnSync(process.execPath, ["--experimental-vm-modules", runnerPath], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: { ...process.env, SECOND_NATURE_WORKSPACE_ROOT: tmp },
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
  assert.equal(result.stdout.trim(), "ok");
});
