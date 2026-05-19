/**
 * Host-safe Second Nature plugin surface.
 *
 * Core logic:
 * - keep register(api) synchronous so OpenClaw captures services/command/tool before return
 * - avoid importing CLI/runtime DB modules at module-evaluation time because the packaged
 *   runtime graph currently contains async sql.js bootstrap that breaks vm sandbox loading
 * - expose a minimal in-memory activation spine so status/lifecycle stay truthful even when
 *   the full workspace runtime is not loaded inside the host
 * - T4.2.1: owner reply ingestion → RelationshipMemory feedback (full runtime only)
 *
 * Dependencies:
 * - only imports runtime lifecycle/service modules that are synchronous at load time
 *
 * Boundaries:
 * - read-only operator flows stay available through command/tool surface
 * - structured mutating flows such as policy set / credential verify remain unavailable here
 * - full evidence-backed workspace runtime can be reintroduced later behind a host-safe boundary
 *
 * Plugin classification (verified against OpenClaw 2026.5.4 internals, see
 * docs/validation/openclaw-plugin-classification.md and the explore reports
 * dated 2026-05-06):
 * - Second Nature is a TOOL plugin (exposes `second_nature_ops` to agent
 *   sessions). It is intentionally NOT a channel/provider/context-engine.
 * - OpenClaw's `loadGatewayStartupPluginPlan` only loads plugins that opt in
 *   via `manifest.activation.onStartup === true`, occupy a configured slot
 *   (channel/contextEngine/provider), or declare an explicit hook intent. A
 *   tool-only plugin without `activation.onStartup` will be enabled in the
 *   registry yet never loaded by the gateway daemon — register(api) only fires
 *   inside the `openclaw plugins enable` CLI process, which produces the
 *   illusion of a working plugin while agent sessions see no tool. We hit
 *   exactly that on 2026-05-06; the fix lives in plugin/openclaw.plugin.json
 *   under the `activation` block.
 * - `Shape: non-capability` reported by `openclaw plugins info` is EXPECTED
 *   for this plugin. OpenClaw counts capabilities only across cli-backend /
 *   text-inference / speech / realtime-* / media-understanding /
 *   image-generation / web-search / agent-harness / context-engine / channel.
 *   Tool/command/service contributions never bump that count. Pretending to
 *   be a context engine with a stub factory just to flip the label would lie
 *   to the host (ContextEngine.ingest/assemble/compact get called for real).
 *   When Second Nature ships a genuine context-engine layer in a future
 *   release, the shape will move to plain-capability honestly.
 *
 * OpenClaw operator norm (T1.1.4 / T1.1.5): set `SECOND_NATURE_WORKSPACE_ROOT` or tool `workspaceRoot` to the
 * **same absolute path** as the OpenClaw **agent workspace** (default `~/.openclaw/workspace`, or
 * `agents.defaults.workspace` in `~/.openclaw/openclaw.json`). Do **not** infer that root from the plugin
 * install directory. With **sandbox** or **per-agent workspaces**, use the path where `data/state.db` and
 * `workspace/` anchors actually live. See `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`.
 *
 * Test coverage:
 * - tests/integration/cli/plugin-runtime-registration.test.ts
 * - tests/integration/cli/plugin-packaging-walkthrough.test.ts
 * - tests/integration/cli/plugin-workspace-ops-bridge.test.ts (T1.1.4 / CH-13 matrix, T1.1.5 ops docs cross-ref)
 */
import {
  startRuntimeService,
  type RuntimeServiceHandle,
} from "./runtime/core/second-nature/runtime/service-entry.js";
import {
  getLifecycleState,
  recordRegistration,
  type LifecycleState,
} from "./runtime/core/second-nature/runtime/lifecycle-service.js";
import { openWorkspaceOpsBridge } from "./workspace-ops-bridge.js";
// definePluginEntry is OpenClaw's canonical factory for non-channel plugins
// (provider/tool/command/service/memory/context-engine). At runtime it returns
// a plain options object; it does NOT add a brand symbol — earlier debugging
// rounds wrongly assumed the factory was the "plain-capability" marker. The
// real classification happens via manifest fields (see file header). We still
// use the factory because it is the documented, supported entry shape, and
// keeping it future-proof against SDK option-processing changes.
//
// IMPORTANT — keep this a STATIC import. The packaged runtime is loaded inside
// OpenClaw's vm sandbox, which rejects top-level await (manifests as
// "SyntaxError: Unexpected identifier 'Promise'" at host load time). The same
// constraint applies to the sql.js async bootstrap noted in the file header.
// In production the host always provides `openclaw` as a sibling module under
// ~/.openclaw/npm/node_modules/, so this resolves synchronously. Locally,
// `openclaw` is declared as a devDependency so build and tests resolve via
// the same import path.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// Stderr sentinels make daemon load-path observable in `gateway.log`. Three
// lines should appear at startup: "module evaluated", "register() entered ...",
// "register() completed". Their absence after `openclaw gateway run` proves
// the daemon never reached this entry — typically a manifest activation gap.
process.stderr.write("[second-nature] module evaluated\n");

interface RegisterApi {
  registerService(service: { id: string; start: () => unknown }): void;
  registerCli?(
    registrar: (ctx: { program: unknown }) => void,
    options?: { commands?: string[] },
  ): void;
  registerCommand(command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: {
      args?: string;
    }) => Promise<{ text: string }> | { text: string };
  }): void;
  registerTool(tool: unknown, options?: unknown): void;
}

type CommandPayload = Record<string, unknown>;
type CommandExecutor = (
  input?: Record<string, unknown>,
) => Promise<CommandPayload>;

type ExplainSubjectType =
  | "decision"
  | "platform-selection"
  | "outreach"
  | "soul-change"
  | "fallback"
  | "probe"
  | "delivery"
  | "report"
  | "source_ref";

interface CommandDefinition {
  name: string;
  description: string;
  execute: CommandExecutor;
}

interface CommandRouter {
  commands: CommandDefinition[];
  resolve(name: string): CommandDefinition | undefined;
}

interface RuntimeEvidence {
  traceId: string;
  capability: "runtime.activate" | "runtime.reload" | "runtime.heartbeat";
  origin: "register" | "service_start";
  createdAt: string;
  status: "succeeded";
}

type WorkspaceRootResolution = "env" | "tool_args" | "unknown";

interface WorkspaceRootContext {
  resolution: WorkspaceRootResolution;
  /** Explicit path from env or tool when set; omitted when unknown + cwd fallback only. */
  declaredRoot?: string;
  /** Path passed to packaged runtime bootstrap (never empty; may be cwd fallback). */
  runtimeRoot: string;
}

interface ActivationSpine {
  router: CommandRouter;
  runtimeHandle: RuntimeServiceHandle;
  lifecycleState: LifecycleState;
  serviceStartRecorded: boolean;
  runtimeEvidence: RuntimeEvidence[];
  workspaceRootContext: WorkspaceRootContext;
}

const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
const HOST_SAFE_LIMITATION_MESSAGE =
  "Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.";

let activationSpine: ActivationSpine | null = null;

/** T1.1.4 — lazily opened full read bridge; closed when workspace root / resolution changes. */
let workspaceOpsBridge: {
  root: string;
  close: () => void;
  dispatch: (
    c: string,
    i?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
} | null = null;

function disposeWorkspaceOpsBridge(): void {
  if (workspaceOpsBridge) {
    workspaceOpsBridge.close();
    workspaceOpsBridge = null;
  }
}

const WORKSPACE_BRIDGE_COMMANDS = new Set([
  "status",
  "quiet",
  "report",
  "session",
  "explain",
  "heartbeat_check",
  "fallback",
  "storage_smoke",
  // T1.2.8 (SN-CODE-03): capability probe surface via workspace bridge
  "capability_probe",
  // T1.2.6 / T1.2.7: policy show + audit read surface
  "policy",
  "audit",
  // T3.3.2: near-real connector smoke sentinel
  "near_real_smoke",
  // v6 ops surface (CR8-01): narrative, goal, dream:recent, connector_status/test, cycle:recent
  "narrative",
  "goal",
  "dream:recent",
  "connector_status",
  "connector_test",
  "cycle:recent",
]);

function isWorkspaceBridgeCommand(
  command: string,
  input?: Record<string, unknown>,
): boolean {
  if (command === "credential") {
    const action = typeof input?.action === "string" ? input.action : "show";
    return action !== "verify";
  }
  return WORKSPACE_BRIDGE_COMMANDS.has(command);
}

async function ensureWorkspaceOpsBridge(spine: ActivationSpine) {
  const root = spine.workspaceRootContext.runtimeRoot;
  if (workspaceOpsBridge?.root === root) {
    return { ok: true as const, dispatch: workspaceOpsBridge.dispatch };
  }
  disposeWorkspaceOpsBridge();
  const opened = await openWorkspaceOpsBridge(root);
  if (!opened.ok) {
    return opened;
  }
  workspaceOpsBridge = { root, close: opened.close, dispatch: opened.dispatch };
  return { ok: true as const, dispatch: opened.dispatch };
}

async function routeSecondNatureCommand(
  spine: ActivationSpine,
  command: string,
  input?: Record<string, unknown>,
): Promise<CommandPayload> {
  const wr = spine.workspaceRootContext;
  const useBridge =
    wr.resolution !== "unknown" && isWorkspaceBridgeCommand(command, input);
  if (useBridge) {
    const bridge = await ensureWorkspaceOpsBridge(spine);
    if (!bridge.ok) {
      return {
        ok: false,
        surfaceMode: "host_safe_carrier",
        workspaceReadModelsEvaluated: false,
        message: HOST_SAFE_LIMITATION_MESSAGE,
        error: bridge.error,
        data: {
          workspaceRootResolution: wr.resolution,
          bridgeAttempted: true,
          declaredRoot: wr.declaredRoot,
        },
      };
    }
    return (await bridge.dispatch(command, input)) as CommandPayload;
  }

  const def = spine.router.resolve(command);
  if (!def) {
    return { ok: false, message: `Unknown Second Nature command: ${command}` };
  }
  return def.execute(input);
}

function resolveWorkspaceRoot(
  toolWorkspaceRoot?: string,
): WorkspaceRootContext {
  const env = process.env.SECOND_NATURE_WORKSPACE_ROOT?.trim();
  if (env) {
    return { resolution: "env", declaredRoot: env, runtimeRoot: env };
  }
  const tool = toolWorkspaceRoot?.trim();
  if (tool) {
    return { resolution: "tool_args", declaredRoot: tool, runtimeRoot: tool };
  }
  return {
    resolution: "unknown",
    declaredRoot: undefined,
    runtimeRoot: process.cwd(),
  };
}

function syncWorkspaceRootFromTool(
  spine: ActivationSpine,
  toolWorkspaceRoot?: string,
): void {
  const next = resolveWorkspaceRoot(toolWorkspaceRoot);
  const prev = spine.workspaceRootContext;
  const changed =
    next.runtimeRoot !== prev.runtimeRoot ||
    next.resolution !== prev.resolution;
  if (changed) {
    disposeWorkspaceOpsBridge();
  }
  spine.workspaceRootContext = next;
  if (changed) {
    spine.runtimeHandle = startRuntimeService({
      workspaceRoot: next.runtimeRoot,
    });
  }
}

function trimRuntimeEvidence(spine: ActivationSpine): void {
  if (spine.runtimeEvidence.length > 12) {
    spine.runtimeEvidence.splice(0, spine.runtimeEvidence.length - 12);
  }
}

function latestRuntimeEvidence(
  spine: ActivationSpine,
): RuntimeEvidence | undefined {
  return spine.runtimeEvidence[spine.runtimeEvidence.length - 1];
}

function createUnavailableActionError(
  code: string,
  message: string,
  requiredUserInput: string[],
  nextStep: string,
): CommandPayload {
  return {
    ok: false,
    error: {
      code,
      message,
      requiredUserInput,
      nextStep,
    },
    message: HOST_SAFE_LIMITATION_MESSAGE,
  };
}

function parseExplainSubject(subjectRaw: string): {
  subjectType: ExplainSubjectType;
  subjectId: string;
} {
  const trimmed = subjectRaw.trim();
  if (!trimmed) {
    throw new Error("explain_subject_invalid");
  }

  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error("explain_subject_requires_id");
  }

  const kind = trimmed.slice(0, separatorIndex).trim();
  const id = trimmed.slice(separatorIndex + 1).trim();
  if (!id) {
    throw new Error("explain_subject_requires_id");
  }

  switch (kind) {
    case "decision":
      return { subjectType: "decision", subjectId: id };
    case "platform":
    case "platform-selection":
      return { subjectType: "platform-selection", subjectId: id };
    case "outreach":
      return { subjectType: "outreach", subjectId: id };
    case "soul":
    case "soul-change":
      return { subjectType: "soul-change", subjectId: id };
    case "fallback":
      return { subjectType: "fallback", subjectId: id };
    case "probe":
      return { subjectType: "probe", subjectId: id };
    case "report":
      return { subjectType: "report", subjectId: id };
    case "delivery":
      return { subjectType: "delivery", subjectId: id };
    case "source":
    case "source_ref":
      return { subjectType: "source_ref", subjectId: id };
    default:
      throw new Error("explain_subject_unsupported");
  }
}

function buildStatusPayload(spine: ActivationSpine): CommandPayload {
  const runtimeEvidence = latestRuntimeEvidence(spine);
  const updatedAt =
    runtimeEvidence?.createdAt ??
    new Date(spine.lifecycleState.lastChangedAt).toISOString();
  const wr = spine.workspaceRootContext;
  const needsRootHint = wr.resolution === "unknown";

  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "WORKSPACE_READ_SURFACE_UNAVAILABLE",
      message:
        "Aggregated status requires workspace state; the host-safe plugin does not load persisted read models on this surface.",
      requiredUserInput: needsRootHint
        ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
        : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      workspaceRootResolution: wr.resolution,
      carrier: {
        host: "openclaw-plugin",
        serviceStatus: spine.runtimeHandle.ready ? "running" : "idle",
        updatedAt,
        lastRuntimeTraceId: runtimeEvidence?.traceId,
      },
    },
  };
}

function buildQuietPayload(
  spine: ActivationSpine,
  scope?: string,
): CommandPayload {
  const wr = spine.workspaceRootContext;
  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "QUIET_READ_SURFACE_UNAVAILABLE",
      message:
        "Quiet read surface requires workspace runtime; not evaluated in host-safe carrier mode.",
      requiredUserInput:
        wr.resolution === "unknown"
          ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
          : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      scope,
      evaluated: false,
      unavailableReason: "host_safe_carrier_no_workspace_db",
      workspaceRootResolution: wr.resolution,
    },
  };
}

function buildReportPayload(
  spine: ActivationSpine,
  day?: string,
): CommandPayload {
  const wr = spine.workspaceRootContext;
  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "REPORT_READ_SURFACE_UNAVAILABLE",
      message: "Daily report artifacts require workspace runtime.",
      requiredUserInput:
        wr.resolution === "unknown"
          ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
          : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      evaluated: false,
      unavailableReason: "host_safe_carrier_no_workspace_db",
      day: day && day.trim() ? day : new Date().toISOString().slice(0, 10),
      workspaceRootResolution: wr.resolution,
    },
  };
}

function buildSessionPayload(
  spine: ActivationSpine,
  sessionId?: string,
): CommandPayload {
  if (!sessionId) {
    return {
      ok: false,
      error: {
        code: "MISSING_SESSION_ID",
        message: "session show requires sessionId",
        requiredUserInput: ["session_id"],
        nextStep: "reinvoke_session_with_session_id",
      },
    };
  }

  const wr = spine.workspaceRootContext;
  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "SESSION_READ_SURFACE_UNAVAILABLE",
      message: "Session analytics require workspace state database.",
      requiredUserInput:
        wr.resolution === "unknown"
          ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
          : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      requestedSessionId: sessionId,
      evaluated: false,
      unavailableReason: "host_safe_carrier_no_workspace_db",
      workspaceRootResolution: wr.resolution,
    },
  };
}

function buildCredentialPayload(
  spine: ActivationSpine,
  platformId?: string,
): CommandPayload {
  const wr = spine.workspaceRootContext;
  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "CREDENTIAL_READ_SURFACE_UNAVAILABLE",
      message:
        "Credential inspection requires workspace runtime on this surface.",
      requiredUserInput:
        wr.resolution === "unknown"
          ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
          : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      platformId: platformId && platformId.trim() ? platformId : undefined,
      evaluated: false,
      unavailableReason: "host_safe_carrier_no_workspace_db",
      workspaceRootResolution: wr.resolution,
    },
  };
}

function buildExplainPayload(
  spine: ActivationSpine,
  subjectRaw?: string,
): CommandPayload {
  if (!subjectRaw?.trim()) {
    return {
      ok: false,
      error: {
        code: "MISSING_EXPLAIN_SUBJECT",
        message: "explain requires subject",
        requiredUserInput: ["subject"],
        nextStep: "reinvoke_explain_with_subject",
      },
    };
  }

  let subject;
  try {
    subject = parseExplainSubject(subjectRaw);
  } catch (error) {
    const code = (error as Error).message;
    if (code === "explain_subject_requires_id") {
      return createUnavailableActionError(
        "EXPLAIN_SUBJECT_REQUIRES_ID",
        "subject must include identifier",
        ["subject"],
        "reinvoke_explain_with_supported_subject",
      );
    }
    if (code === "explain_subject_unsupported") {
      return createUnavailableActionError(
        "EXPLAIN_SUBJECT_UNSUPPORTED",
        "supported subjects include decision:, platform:, outreach:, soul:, fallback:, delivery:, probe:, report:, source:",
        ["subject"],
        "reinvoke_explain_with_supported_subject",
      );
    }
    return createUnavailableActionError(
      "EXPLAIN_SUBJECT_INVALID",
      "invalid explain subject",
      ["subject"],
      "reinvoke_explain_with_supported_subject",
    );
  }

  const wr = spine.workspaceRootContext;
  return {
    ok: false,
    surfaceMode: "host_safe_carrier",
    workspaceReadModelsEvaluated: false,
    message: HOST_SAFE_LIMITATION_MESSAGE,
    error: {
      code: "EXPLAIN_READ_SURFACE_UNAVAILABLE",
      message:
        "Evidence-backed explain requires persisted workspace read models; host-safe carrier did not evaluate operator explain (CH-11-02).",
      requiredUserInput:
        wr.resolution === "unknown"
          ? ["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"]
          : [],
      nextStep: "run_workspace_second_nature_cli_or_full_runtime_package",
    },
    data: {
      subjectType: subject.subjectType,
      evaluated: false,
      workspaceRootResolution: wr.resolution,
    },
  };
}

async function buildStorageSmokePayload(
  input?: Record<string, unknown>,
): Promise<CommandPayload> {
  try {
    const mod =
      await import("./runtime/storage/bootstrap/storage-mode-smoke.js");
    const runRepairFixture = Boolean(input?.runRepairFixture);
    const workspaceRoot =
      typeof input?.workspaceRoot === "string"
        ? input.workspaceRoot
        : undefined;
    const data = await mod.runStorageModeSmoke({
      runRepairFixture,
      workspaceRoot,
    });
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      error: {
        code: "STORAGE_SMOKE_LOAD_FAILED",
        message: "Could not load packaged storage-mode smoke module",
        nextStep: "rebuild_plugin_runtime_package",
      },
    };
  }
}

function buildFallbackHostSafePayload(ref?: string): CommandPayload {
  if (!ref?.trim()) {
    return {
      ok: false,
      error: {
        code: "MISSING_FALLBACK_REF",
        message: "fallback requires ref (e.g. fallback:…)",
        requiredUserInput: ["ref"],
        nextStep: "reinvoke_with_ref",
      },
    };
  }
  return createUnavailableActionError(
    "HOST_SAFE_FALLBACK_VIEW_UNAVAILABLE",
    "Operator fallback view requires workspace state database; host-safe plugin cannot read persisted fallback artifacts.",
    ["ref"],
    "run_workspace_second_nature_cli_or_full_runtime_package",
  );
}

function isProbeOnlyInput(input?: Record<string, unknown>): boolean {
  const v = input?.probeOnly;
  return v === true || v === "true" || v === 1 || v === "1";
}

function buildHeartbeatCheckPayload(
  spine: ActivationSpine,
  input?: Record<string, unknown>,
): CommandPayload {
  const runtimeEvidence = latestRuntimeEvidence(spine);
  const updatedAt =
    runtimeEvidence?.createdAt ??
    new Date(spine.lifecycleState.lastChangedAt).toISOString();
  const timestamp =
    typeof input?.timestamp === "string" && input.timestamp.trim().length > 0
      ? input.timestamp
      : updatedAt;
  const wr = spine.workspaceRootContext;

  if (isProbeOnlyInput(input)) {
    return {
      ok: true,
      status: "heartbeat_ok",
      surfaceMode: "capability_probe",
      reasons: ["probe_only"],
      livedExperienceLoopClaimed: false,
      scope: "rhythm",
      trigger: "heartbeat_bridge",
      message:
        "Capability probe only on the host-safe carrier surface; does not claim a full lived-experience decision loop.",
      data: {
        workspaceRootResolution: wr.resolution,
        runtime: {
          host: "openclaw-plugin",
          serviceStatus: spine.runtimeHandle.ready ? "running" : "idle",
          updatedAt,
        },
        surface: {
          tool: "second_nature_ops",
          command: "second-nature heartbeat_check",
        },
        bridge: {
          timestamp,
          probeOnly: true,
          sessionContextProvided:
            typeof input?.sessionContext === "string" &&
            input.sessionContext.trim().length > 0,
          heartbeatChecklistProvided:
            typeof input?.heartbeatChecklist === "string" &&
            input.heartbeatChecklist.trim().length > 0,
          serviceEntryMode: "capability_probe",
        },
      },
    };
  }

  return {
    ok: true,
    status: "runtime_carrier_only",
    surfaceMode: "host_safe_carrier",
    livedExperienceLoopClaimed: false,
    scope: "rhythm",
    trigger: "heartbeat_bridge",
    reasons: ["runtime_carrier_only", "host_safe_bridge_ack"],
    nextAction: "continue_carrier_surface_only",
    message:
      "Packaged carrier acknowledged this heartbeat round. This is not a full lived-experience decision loop; use the workspace CLI when read models are required.",
    data: {
      workspaceRootResolution: wr.resolution,
      runtime: {
        host: "openclaw-plugin",
        serviceStatus: spine.runtimeHandle.ready ? "running" : "idle",
        updatedAt,
      },
      surface: {
        tool: "second_nature_ops",
        command: "second-nature heartbeat_check",
      },
      bridge: {
        timestamp,
        sessionContextProvided:
          typeof input?.sessionContext === "string" &&
          input.sessionContext.trim().length > 0,
        heartbeatChecklistProvided:
          typeof input?.heartbeatChecklist === "string" &&
          input.heartbeatChecklist.trim().length > 0,
        serviceEntryMode: "runtime_carrier_only",
      },
    },
  };
}

function createHostSafeRouter(spine: ActivationSpine): CommandRouter {
  const commands: CommandDefinition[] = [
    {
      name: "status",
      description: "Show aggregated Second Nature status",
      execute: async () => buildStatusPayload(spine),
    },
    {
      name: "policy",
      description: "Write or inspect policy state",
      execute: async (input) => {
        const action =
          typeof input?.action === "string" ? input.action : "show";
        if (action === "set") {
          return createUnavailableActionError(
            "HOST_SAFE_POLICY_SET_UNAVAILABLE",
            "policy set is unavailable in the host-safe plugin package",
            ["social_daily_limit", "quiet_enabled"],
            "run_workspace_runtime_or_reinstall_full_build",
          );
        }
        return createUnavailableActionError(
          "HOST_SAFE_POLICY_SHOW_UNAVAILABLE",
          "Policy read requires workspace state database; host-safe plugin does not load persisted policy rows.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        );
      },
    },
    {
      name: "credential",
      description: "Inspect or recover credential state",
      execute: async (input) => {
        const action =
          typeof input?.action === "string" ? input.action : "show";
        if (action === "verify") {
          return createUnavailableActionError(
            "HOST_SAFE_CREDENTIAL_VERIFY_UNAVAILABLE",
            "credential verify is unavailable in the host-safe plugin package",
            ["verification_answer"],
            "run_workspace_runtime_or_reinstall_full_build",
          );
        }
        const platformId =
          typeof input?.platformId === "string" ? input.platformId : undefined;
        return buildCredentialPayload(spine, platformId);
      },
    },
    {
      name: "quiet",
      description: "Inspect Quiet lifecycle state",
      execute: async (input) => {
        const scope =
          typeof input?.scope === "string" ? input.scope : undefined;
        return buildQuietPayload(spine, scope);
      },
    },
    {
      name: "report",
      description: "Show daily report artifacts",
      execute: async (input) => {
        const day = typeof input?.day === "string" ? input.day : undefined;
        return buildReportPayload(spine, day);
      },
    },
    {
      name: "session",
      description: "Inspect continuity session details",
      execute: async (input) => {
        const sessionId =
          typeof input?.sessionId === "string" ? input.sessionId : undefined;
        return buildSessionPayload(spine, sessionId);
      },
    },
    {
      name: "audit",
      description: "Inspect audit and evidence views",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_AUDIT_UNAVAILABLE",
          "Audit read requires workspace observability database; host-safe plugin does not load persisted audit events.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "explain",
      description: "Answer why-question explain requests",
      execute: async (input) => {
        const subject =
          typeof input?.subject === "string" ? input.subject : undefined;
        return buildExplainPayload(spine, subject);
      },
    },
    {
      name: "heartbeat_check",
      description: "Acknowledge the shipping heartbeat bridge round",
      execute: async (input) => buildHeartbeatCheckPayload(spine, input),
    },
    {
      name: "fallback",
      description:
        "Operator-visible delivery fallback view (full workspace runtime required)",
      execute: async (input) => {
        const ref =
          typeof input?.ref === "string" ? input.ref.trim() : undefined;
        return buildFallbackHostSafePayload(ref);
      },
    },
    {
      name: "storage_smoke",
      description: "T4.1.4 storage mode smoke report (sql.js vs native probe)",
      execute: async (input) => buildStorageSmokePayload(input),
    },
    {
      name: "capability_probe",
      description:
        "Probe host capabilities (workspace runtime required for full report)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_CAPABILITY_PROBE_UNAVAILABLE",
          "Full capability probe requires workspace observability database for persistence; host-safe carrier returns static unknown.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "near_real_smoke",
      description:
        "Run near-real connector smoke (workspace runtime + connectors required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_NEAR_REAL_SMOKE_UNAVAILABLE",
          "Near-real connector smoke requires workspace state and observability databases; host-safe plugin cannot run connector harness.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    // v6 ops surface (CR8-01): host-safe router returns unavailable for workspace-only commands
    {
      name: "narrative",
      description: "Show current NarrativeState (workspace runtime required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_NARRATIVE_UNAVAILABLE",
          "NarrativeState read requires workspace state database; host-safe plugin does not load persisted narrative rows.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "goal",
      description: "Owner-governed goal operations (workspace runtime required)",
      execute: async (input) => {
        const action = typeof input?.action === "string" ? input.action : "list";
        if (action === "set" || action === "accept" || action === "reject") {
          return createUnavailableActionError(
            "HOST_SAFE_GOAL_MUTATE_UNAVAILABLE",
            "Goal mutation requires workspace state database; host-safe plugin cannot write persisted goal rows.",
            [],
            "run_workspace_second_nature_cli_or_full_runtime_package",
          );
        }
        return createUnavailableActionError(
          "HOST_SAFE_GOAL_READ_UNAVAILABLE",
          "Goal list/read requires workspace state database; host-safe plugin does not load persisted goal rows.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        );
      },
    },
    {
      name: "dream:recent",
      description: "Show recent Dream runs (workspace runtime required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_DREAM_RECENT_UNAVAILABLE",
          "Dream recent read requires workspace observability database; host-safe plugin does not load persisted audit events.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "connector_status",
      description: "Show connector inventory (workspace runtime required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_CONNECTOR_STATUS_UNAVAILABLE",
          "Connector status requires workspace state and registry scan; host-safe plugin cannot access connector manifests.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "connector_test",
      description: "Dry-run test a connector (workspace runtime required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_CONNECTOR_TEST_UNAVAILABLE",
          "Connector test requires workspace state and registry; host-safe plugin cannot run connector harness.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
    {
      name: "cycle:recent",
      description: "Show recent cycle summary (workspace runtime required)",
      execute: async () =>
        createUnavailableActionError(
          "HOST_SAFE_CYCLE_RECENT_UNAVAILABLE",
          "Cycle recent read requires workspace observability database; host-safe plugin does not load persisted audit events.",
          [],
          "run_workspace_second_nature_cli_or_full_runtime_package",
        ),
    },
  ];

  return {
    commands,
    resolve(name: string) {
      return commands.find((command) => command.name === name);
    },
  };
}

function createActivationSpine(): ActivationSpine {
  const workspaceRootContext = resolveWorkspaceRoot(undefined);
  const spine = {
    router: undefined as unknown as CommandRouter,
    runtimeHandle: startRuntimeService({
      workspaceRoot: workspaceRootContext.runtimeRoot,
    }),
    lifecycleState: getLifecycleState(),
    serviceStartRecorded: false,
    runtimeEvidence: [],
    workspaceRootContext,
  } satisfies ActivationSpine;

  spine.router = createHostSafeRouter(spine);
  return spine;
}

function ensureActivationSpine(): ActivationSpine {
  if (activationSpine) {
    return activationSpine;
  }

  activationSpine = createActivationSpine();
  return activationSpine;
}

function recordRuntimeEvidence(
  spine: ActivationSpine,
  origin: "register" | "service_start",
): void {
  if (origin === "service_start" && spine.serviceStartRecorded) {
    return;
  }

  if (origin === "service_start") {
    spine.serviceStartRecorded = true;
  }

  spine.runtimeEvidence.push({
    traceId: `${INTERNAL_RUNTIME_TRACE_PREFIX}${origin}-${spine.lifecycleState.registerCount}-${Date.now()}`,
    capability:
      origin === "register"
        ? spine.lifecycleState.registerCount === 1
          ? "runtime.activate"
          : "runtime.reload"
        : "runtime.heartbeat",
    origin,
    createdAt: new Date().toISOString(),
    status: "succeeded",
  });
  trimRuntimeEvidence(spine);
}

function refreshRegistrationState(): ActivationSpine {
  const spine = ensureActivationSpine();
  const workspaceRootContext = resolveWorkspaceRoot(undefined);
  const prev = spine.workspaceRootContext;
  const changed =
    workspaceRootContext.runtimeRoot !== prev.runtimeRoot ||
    workspaceRootContext.resolution !== prev.resolution;
  if (changed) {
    disposeWorkspaceOpsBridge();
  }
  spine.workspaceRootContext = workspaceRootContext;
  spine.runtimeHandle = startRuntimeService({
    workspaceRoot: workspaceRootContext.runtimeRoot,
  });
  spine.lifecycleState = recordRegistration();
  spine.serviceStartRecorded = false;
  recordRuntimeEvidence(spine, "register");
  return spine;
}

function parseCommandInput(
  rawArgs?: string,
):
  | { ok: true; command: string; input?: Record<string, unknown> }
  | { ok: false; result: Record<string, unknown> } {
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
        message:
          "policy set requires structured args; use second_nature_ops instead.",
      },
    };
  }

  if (command === "credential" && rest[0] === "verify") {
    return {
      ok: false,
      result: {
        ok: false,
        command,
        message:
          "credential verify requires structured args; use second_nature_ops instead.",
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
    case "heartbeat_check":
      return {
        ok: true,
        command,
        input:
          rest.length > 0
            ? {
                timestamp: rest[0],
                sessionContext:
                  rest.length > 1 ? rest.slice(1).join(" ") : undefined,
              }
            : undefined,
      };
    case "explain":
      return {
        ok: true,
        command,
        input: rest.length > 0 ? { subject: rest.join(" ") } : undefined,
      };
    case "fallback":
      return {
        ok: true,
        command,
        input: rest.length > 0 ? { ref: rest.join(" ") } : undefined,
      };
    case "storage_smoke": {
      const wantRepair = rest[0] === "repair" || rest.includes("--repair");
      return {
        ok: true,
        command,
        input: wantRepair ? { runRepairFixture: true } : undefined,
      };
    }
    // v6 ops surface (CR8-01): simple command parsing for new commands
    case "narrative":
      return {
        ok: true,
        command,
        input: rest[0] ? { narrativeId: rest[0] } : undefined,
      };
    case "goal":
      return {
        ok: true,
        command,
        input: rest.length > 0 ? { action: rest[0], goalId: rest[1] } : undefined,
      };
    case "dream:recent":
      return {
        ok: true,
        command,
        input: rest[0] ? { limit: Number(rest[0]) } : undefined,
      };
    case "connector_status":
      return { ok: true, command, input: undefined };
    case "connector_test":
      return {
        ok: true,
        command,
        input: rest[0] ? { platformId: rest[0] } : undefined,
      };
    case "cycle:recent":
      return {
        ok: true,
        command,
        input: rest[0] ? { limit: Number(rest[0]) } : undefined,
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

const SECOND_NATURE_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    command: { type: "string" },
    args: { type: "object", additionalProperties: true },
    workspaceRoot: {
      type: "string",
      description:
        "Workspace root for packaged smoke/runtime alignment (optional; prefer SECOND_NATURE_WORKSPACE_ROOT).",
    },
  },
  required: ["command"],
} as const;

export default definePluginEntry({
  id: "second-nature",
  name: "Second Nature",
  description:
    "Registers command/tool/service surface with load-reload lifecycle semantics.",
  register(api: RegisterApi) {
    process.stderr.write(
      `[second-nature] register() entered, api keys=${Object.keys(api as object).join(",")}\n`,
    );
    const runtimeService = createRuntimeService();
    const lifecycleService = createLifecycleService();

    api.registerService(runtimeService);
    api.registerService(lifecycleService);

    api.registerCommand({
      name: "second-nature",
      description: "Route Agent-facing operational commands for Second Nature.",
      acceptsArgs: true,
      handler: async (ctx: { args?: string }) => {
        const spine = ensureActivationSpine();
        const parsed = parseCommandInput(ctx.args);
        if (!parsed.ok) {
          return {
            text: JSON.stringify(parsed.result),
          };
        }

        const resolved = spine.router.resolve(parsed.command);
        if (!resolved) {
          return {
            text: JSON.stringify({
              ok: false,
              command: parsed.command,
              message: "Unknown Second Nature command.",
            }),
          };
        }

        const result = await routeSecondNatureCommand(
          spine,
          parsed.command,
          parsed.input,
        );
        return {
          text: JSON.stringify(result),
        };
      },
    });

    const executeSecondNatureTool = async (params: {
      command: string;
      args?: Record<string, unknown>;
      workspaceRoot?: string;
    }) => {
      const spine = ensureActivationSpine();
      syncWorkspaceRootFromTool(spine, params.workspaceRoot);
      const resolved = spine.router.resolve(params.command);
      if (!resolved) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                message: "Unknown Second Nature command.",
              }),
            },
          ],
        };
      }

      const result = await routeSecondNatureCommand(
        spine,
        params.command,
        params.args,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    };

    api.registerTool({
      name: "second_nature_ops",
      description:
        "Access the Second Nature command surface through a single tool shell.",
      parameters: SECOND_NATURE_TOOL_SCHEMA,
      async execute(
        _id: string,
        params: {
          command: string;
          args?: Record<string, unknown>;
          workspaceRoot?: string;
        },
      ) {
        return executeSecondNatureTool(params);
      },
    });

    process.stderr.write("[second-nature] register() completed\n");
  },
});
