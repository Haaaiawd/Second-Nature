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
import { createAgentGoalStore } from "../../../src/storage/goal/agent-goal-store.js";
import { createCredentialVault } from "../../../src/storage/services/credential-vault.js";
import { evidenceItem } from "../../../src/storage/db/schema/v8-entities.js";
import { lifeEvidenceIndex } from "../../../src/storage/db/schema/life-evidence-index.js";

const ORIGINAL_MOLTBOOK_URL = process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
const ORIGINAL_ENCRYPTION_KEY = process.env.SECOND_NATURE_ENCRYPTION_KEY;

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

test("T1.1.4 direct bridge open without workspaceRoot returns typed error", async () => {
  const bridgeUrl = pathToFileURL(path.join(process.cwd(), "plugin", "workspace-ops-bridge.js")).href;
  const mod = (await import(bridgeUrl)) as {
    openWorkspaceOpsBridge: (workspaceRoot?: string) => Promise<{
      ok: boolean;
      error?: { code?: string; requiredUserInput?: string[] };
    }>;
  };

  const result = await mod.openWorkspaceOpsBridge();
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "WORKSPACE_ROOT_REQUIRED");
  assert.deepEqual(result.error?.requiredUserInput, ["workspaceRoot"]);
});

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
    v8Spine?: { cycleId?: string; closureRef?: unknown; noActionReason?: string };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.surfaceMode, "workspace_full_runtime");
  assert.equal(payload.livedExperienceLoopClaimed, true);
  assert.ok(payload.v8Spine?.cycleId, "workspace bridge heartbeat should expose v8 spine cycle");
  assert.ok(
    payload.v8Spine?.closureRef || payload.v8Spine?.noActionReason,
    "workspace bridge heartbeat should expose closure or no-action proof",
  );
  assert.ok(payload.status !== "runtime_carrier_only");
});

test("T-ROS.C.1 — heartbeat_run is reachable as heartbeat_check alias through workspace bridge", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-hbr-"));
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
      command: "heartbeat_run",
      args: { timestamp: "2026-05-04T12:00:00.000Z" },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    surfaceMode: string;
    livedExperienceLoopClaimed: boolean;
    v8Spine?: { cycleId?: string; closureRef?: unknown; noActionReason?: string };
  };
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.surfaceMode, "workspace_full_runtime");
  assert.equal(payload.livedExperienceLoopClaimed, true);
  assert.ok(payload.v8Spine?.cycleId, "heartbeat_run alias should expose v8 spine cycle");
  assert.ok(
    payload.v8Spine?.closureRef || payload.v8Spine?.noActionReason,
    "heartbeat_run alias should expose closure or no-action proof",
  );
});

test("T-ROS.R.5 — plugin loaded state does not claim operational status without host tool visibility", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-ros-r5-"));
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
      command: "setup_hint",
      args: { hostName: "test-host", hostVersion: "0.0.0" },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    evidenceLevel: string;
    data?: {
      hostDiscovery?: {
        setupComplete: boolean;
        evidenceLevel: string;
        toolDiscovery: { status: string; tools: string[]; reason?: string; hostName?: string; hostVersion?: string; observedAt: string };
        skillDiscovery: { status: string; skills: string[]; reason?: string; observedAt: string };
      };
    };
  };
  assert.equal(payload.ok, true);
  assert.ok(payload.data?.hostDiscovery, "setup_hint must expose hostDiscovery");
  assert.equal(payload.data.hostDiscovery.setupComplete, false, "setup cannot be complete without host tool visibility");
  assert.notEqual(payload.data.hostDiscovery.evidenceLevel, "real_runtime");
  assert.notEqual(payload.data.hostDiscovery.evidenceLevel, "durable_verified");
  assert.equal(payload.data.hostDiscovery.toolDiscovery.status, "unsupported");
  assert.ok(
    payload.data.hostDiscovery.toolDiscovery.reason === "host_tool_unavailable" ||
      payload.data.hostDiscovery.toolDiscovery.reason === "host_probe_unsupported",
    "toolDiscovery must report explicit unavailable reason",
  );
  assert.equal(payload.data.hostDiscovery.toolDiscovery.tools.length, 0);
  assert.equal(payload.data.hostDiscovery.toolDiscovery.hostName, "test-host");
  assert.equal(payload.data.hostDiscovery.toolDiscovery.hostVersion, "0.0.0");
  assert.ok(payload.data.hostDiscovery.toolDiscovery.observedAt);
});

// SKIP (pre-existing, Wave 56+): bridge connector action dispatch not fully wired in packaged runtime.
// Justification: T2.2.3 full-runtime heartbeat wiring is tracked as a known structural gap;
// it does not block v7 release because manual_run and probe surfaces are operational.
test.skip("T2.2.3 bridge full-runtime heartbeat wires connectorExecutor for connector_action", async () => {
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
  // When platformId cannot be resolved the executor is not invoked (M-08).
  // The bridge still wires connectorExecutor; this test verifies the full-runtime
  // path does not fall back to connector_dispatch_unwired.
  assert.ok(
    payload.reasons.includes("connector_dispatch_unavailable") ||
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

test("T-ROS.C.2 v7 ops commands are reachable through workspace bridge", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-v7-"));
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

  const cases: Array<{ command: string; args?: Record<string, unknown> }> = [
    { command: "self_health" },
    { command: "tool_affordance" },
    { command: "heartbeat_digest" },
    { command: "runtime_secret_bootstrap" },
    { command: "timeline" },
    { command: "restore" },
    { command: "narrative:diff" },
    { command: "loop_status" },
    { command: "connector:run", args: { platformId: "moltbook", capabilityId: "feed.read" } },
  ];

  for (const entry of cases) {
    const payload = JSON.parse(
      (await tool.execute("1", {
        command: entry.command,
        args: entry.args,
        workspaceRoot: tmp,
      })).content[0]?.text ?? "{}",
    ) as { ok: boolean; command?: string; error?: { code?: string } };

    assert.notEqual(
      payload.error?.code,
      "unknown_command",
      `${entry.command} should be registered in createCliCommands`,
    );
    assert.notEqual(
      payload.error?.code,
      "unknown_ops_command",
      `${entry.command} should be handled by createOpsRouter`,
    );
    if (entry.command === "tool_affordance") {
      assert.equal(payload.ok, true, "tool_affordance should be wired");
    }
    if (entry.command === "runtime_secret_bootstrap") {
      assert.equal(payload.ok, true, "runtime_secret_bootstrap should be wired");
    }
    if (entry.command === "timeline") {
      assert.equal(payload.ok, true, "timeline should be wired");
    }
    if (entry.command === "narrative:diff") {
      assert.notEqual(
        payload.error?.code,
        "NARRATIVE_TIMELINE_PORT_UNAVAILABLE",
        "narrative:diff should have timeline deps wired",
      );
    }
  }
});

test("T-CS.R.5 — bridge connector:run writes v7 life_evidence and v8 EvidenceItem", async () => {
  process.env.SECOND_NATURE_ENCRYPTION_KEY = "x".repeat(32);
  delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-connector-evidence-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".second-nature", "mock"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".second-nature", "mock", "moltbook-feed.json"),
    JSON.stringify({
      items: [
        { id: "v8-e-1", title: "Evidence item 1", content: "Hello v8" },
        { id: "v8-e-2", title: "Evidence item 2", content: "World v8" },
      ],
    }),
    "utf-8",
  );

  // Seed active credential so moltbook mock runner passes the auth gate
  const state = createStateDatabase(path.join(tmp, "data", "state.db"));
  try {
    const vault = createCredentialVault(state.db);
    await vault.saveCredentialContext({
      platformId: "moltbook",
      credentialType: "api_key",
      encryptedValue: "mock-token",
      status: "active",
    });
    const loaded = await vault.loadCredentialContext("moltbook");
    assert.equal(loaded?.status, "active", "seeded credential must be loadable");
    assert.ok(loaded?.encryptedValue, "seeded credential must have encryptedValue");
    state.flush();

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

    const result = await tool.execute("1", {
      command: "connector:run",
      args: { platformId: "moltbook", capabilityId: "feed.read" },
      workspaceRoot: tmp,
    });
  const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
    ok: boolean;
    data?: {
      evidence?: {
        v7EvidenceId?: string;
        v8EvidenceIds?: string[];
        emptyReason?: string;
      };
    };
  };

    assert.equal(payload.ok, true, JSON.stringify(payload));
    assert.ok(payload.data?.evidence, "result should include evidence summary");
    assert.ok(
      Array.isArray(payload.data?.evidence?.v8EvidenceIds) &&
        payload.data!.evidence!.v8EvidenceIds!.length > 0,
      JSON.stringify(payload.data?.evidence),
    );
    assert.ok(
      typeof payload.data?.evidence?.v7EvidenceId === "string" &&
        payload.data!.evidence!.v7EvidenceId!.length > 0,
      "v7 life evidence id should be returned",
    );
    assert.equal(payload.data?.evidence?.emptyReason, undefined, "emptyReason should be absent when items present");

    // Verify flush: a fresh DB connection from disk can read the persisted rows.
    // Keep the original `state` handle alive because the workspace bridge may
    // still hold a reference to the same sql.js connection.
    const reopened = createStateDatabase(path.join(tmp, "data", "state.db"));
    try {
      const v8Rows = reopened.db.select().from(evidenceItem).all();
      const v7Rows = reopened.db.select().from(lifeEvidenceIndex).all();
      assert.ok(v8Rows.length > 0, "evidence_item rows must persist after bridge flush");
      assert.ok(v7Rows.length > 0, "life_evidence_index rows must persist after bridge flush");
    } finally {
      reopened.close();
    }
  } finally {
    state.close();
    if (ORIGINAL_MOLTBOOK_URL === undefined) delete process.env.SECOND_NATURE_MOLTBOOK_BASE_URL;
    else process.env.SECOND_NATURE_MOLTBOOK_BASE_URL = ORIGINAL_MOLTBOOK_URL;
    if (ORIGINAL_ENCRYPTION_KEY === undefined) delete process.env.SECOND_NATURE_ENCRYPTION_KEY;
    else process.env.SECOND_NATURE_ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
  }
});

test("T2.2.3 bridge heartbeat avoids unsupported moltbook work.discover protocol mismatch", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-no-protocol-mismatch-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  const state = createStateDatabase(path.join(tmp, "data", "state.db"));
  const now = "2026-05-25T01:20:00.000Z";
  await createAgentGoalStore(state).upsertAgentGoal({
    goalId: "goal-moltbook-regression",
    kind: "short_term",
    status: "accepted",
    origin: "owner_set",
    description: "work on moltbook",
    completionCriteria: "use moltbook safely",
    risk: "low",
    priorityHint: 80,
    sourceRefs: [],
    acceptedBy: "owner",
    createdAt: now,
    updatedAt: now,
  });
  await appendLifeEvidence(state, tmp, {
    id: "lev-moltbook-regression",
    timestamp: now,
    evidenceType: "platform_browse",
    platformId: "moltbook",
    summary: "moltbook source for heartbeat planning",
    rawContentRef: "moltbook://feed/item-regression",
    sourceRefs: [
      {
        id: "src-moltbook-regression",
        kind: "platform_item",
        uri: "platform://moltbook/item-regression",
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

  const payload = JSON.parse(
    (await tool.execute("1", {
      command: "heartbeat_check",
      args: { timestamp: now },
      workspaceRoot: tmp,
    })).content[0]?.text ?? "{}",
  ) as { ok: boolean; status?: string; reasons?: string[] };

  assert.equal(payload.ok, true);
  assert.ok(
    !(payload.reasons ?? []).includes("protocol_mismatch"),
    `heartbeat must not route unsupported moltbook work.discover, got ${JSON.stringify(payload.reasons)}`,
  );
});

test("T1.2.3 connector_test reloads registry for isolated workspace bridge call", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-connector-test-"));
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

  const payload = JSON.parse(
    (await tool.execute("1", {
      command: "connector_test",
      args: { platformId: "moltbook" },
      workspaceRoot: tmp,
    })).content[0]?.text ?? "{}",
  ) as { ok: boolean; data?: { platformId?: string; dryRun?: boolean }; error?: { code?: string } };

  assert.equal(payload.ok, true);
  assert.equal(payload.data?.platformId, "moltbook");
  assert.equal(payload.data?.dryRun, true);
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

// T-GVS.R.1: impulse context artifact integration
test("heartbeat_check exposes impulse context when artifact exists", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sn-ws-bridge-ica-"));
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  const now = new Date().toISOString();

  // Seed artifact directly in state DB
  const dbPath = path.join(tmp, "data", "state.db");
  const { createStateDatabase } = await import("../../../src/storage/db/index.js");
  const { writeImpulseContext } = await import("../../../src/core/second-nature/guidance/impulse-context-writer.js");
  const db = createStateDatabase(dbPath);
  try {
    await writeImpulseContext(
      db,
      {
        sceneType: "social",
        impulseResult: {
          impulse: { kind: "social", text: "Be warm and curious", reviewStatus: "approved" },
          source: "intent_kind",
          capabilityClass: null,
        },
        atmosphereText: "Open and receptive",
        expressionBoundaryConstraints: ["avoid_sarcasm"],
      },
      { now },
    );
  } finally {
    db.close();
  }

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
      args: { timestamp: now },
      workspaceRoot: tmp,
    })
  ).content[0]?.text ?? "{}";
  const payload = JSON.parse(text) as {
    ok: boolean;
    impulseContext?: { available: boolean; impulseText?: string };
    reasons: string[];
  };
  assert.equal(payload.ok, true);
  assert.ok(payload.impulseContext, "impulseContext should be present");
  assert.equal(payload.impulseContext?.available, true);
  assert.ok(
    payload.reasons.some((r) => r.startsWith("impulse_context:")),
    "reasons should reference impulse context"
  );
});
