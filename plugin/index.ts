/**
 * Host-safe Second Nature plugin surface.
 *
 * Core logic:
 * - keep register(api) synchronous so OpenClaw captures services/command/tool before return
 * - avoid importing CLI/runtime DB modules at module-evaluation time because the packaged
 *   runtime graph currently contains async sql.js bootstrap that breaks vm sandbox loading
 * - expose a minimal in-memory activation spine so status/lifecycle stay truthful even when
 *   the full workspace runtime is not loaded inside the host
 *
 * Dependencies:
 * - only imports runtime lifecycle/service modules that are synchronous at load time
 *
 * Boundaries:
 * - read-only operator flows stay available through command/tool surface
 * - structured mutating flows such as policy set / credential verify remain unavailable here
 * - full evidence-backed workspace runtime can be reintroduced later behind a host-safe boundary
 *
 * Test coverage:
 * - tests/integration/cli/plugin-runtime-registration.test.ts
 * - tests/integration/cli/plugin-packaging-walkthrough.test.ts
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

interface RegisterApi {
  registerService(service: { id: string; start: () => unknown }): void;
  registerCli?(registrar: (ctx: { program: unknown }) => void, options?: { commands?: string[] }): void;
  registerCommand(command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: { args?: string }) => Promise<{ text: string }> | { text: string };
  }): void;
  registerTool(tool: unknown, options?: unknown): void;
}

type CommandPayload = Record<string, unknown>;
type CommandExecutor = (input?: Record<string, unknown>) => Promise<CommandPayload>;

type ExplainSubjectType = "decision" | "platform-selection" | "outreach" | "soul-change";

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

interface ActivationSpine {
  router: CommandRouter;
  runtimeHandle: RuntimeServiceHandle;
  lifecycleState: LifecycleState;
  serviceStartRecorded: boolean;
  runtimeEvidence: RuntimeEvidence[];
}

const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
const HOST_SAFE_LIMITATION_MESSAGE =
  "Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.";

let activationSpine: ActivationSpine | null = null;

function trimRuntimeEvidence(spine: ActivationSpine): void {
  if (spine.runtimeEvidence.length > 12) {
    spine.runtimeEvidence.splice(0, spine.runtimeEvidence.length - 12);
  }
}

function latestRuntimeEvidence(spine: ActivationSpine): RuntimeEvidence | undefined {
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

function parseExplainSubject(subjectRaw: string): { subjectType: ExplainSubjectType; subjectId: string } {
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
    default:
      throw new Error("explain_subject_unsupported");
  }
}

function buildStatusPayload(spine: ActivationSpine): CommandPayload {
  const runtimeEvidence = latestRuntimeEvidence(spine);
  const updatedAt = runtimeEvidence?.createdAt ?? new Date(spine.lifecycleState.lastChangedAt).toISOString();

  return {
    ok: true,
    data: {
      runtime: {
        host: "openclaw-plugin",
        serviceStatus: spine.runtimeHandle.ready ? "running" : "idle",
        updatedAt,
      },
      rhythm: {
        mode: "active",
        windowId: undefined,
      },
      quiet: {
        mode: "unknown",
        lastEvent: runtimeEvidence?.traceId,
        interrupted: undefined,
      },
      connectors: [],
      credentials: [],
      risk: {
        level: "low",
        flags: [],
      },
    },
  };
}

function buildQuietPayload(scope?: string): CommandPayload {
  return {
    ok: true,
    data: {
      scope,
      mode: "unknown",
      sourceCount: 0,
      reportCount: 0,
      recentJournalCount: 0,
    },
  };
}

function buildReportPayload(day?: string): CommandPayload {
  return {
    ok: true,
    data: {
      day: day && day.trim() ? day : new Date().toISOString().slice(0, 10),
      summary: "",
      highlights: [],
      sourceRefs: [],
    },
  };
}

function buildSessionPayload(sessionId?: string): CommandPayload {
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

  return {
    ok: true,
    data: {
      requestedSessionId: sessionId,
      traceId: sessionId,
      decisionCount: 0,
      attemptCount: 0,
      governanceCount: 0,
      keyFactors: [],
      evidenceRefs: [],
    },
  };
}

function buildCredentialPayload(platformId?: string): CommandPayload {
  return {
    ok: true,
    data: {
      platformId: platformId && platformId.trim() ? platformId : "unknown",
      status: "missing",
      nextStep: "provide_credential_context",
    },
  };
}

function buildExplainPayload(spine: ActivationSpine, subjectRaw?: string): CommandPayload {
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
        "supported subjects are decision:<id>, platform:<id>, outreach:<id>, soul:<id>",
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

  const runtimeEvidence = latestRuntimeEvidence(spine);
  return {
    ok: true,
    data: {
      subjectType: subject.subjectType,
      conclusion: "Plugin surface is loaded in host-safe mode with a minimal activation spine.",
      keyFactors: [
        "synchronous_register",
        `subject:${subject.subjectId}`,
        runtimeEvidence?.capability ?? "runtime.activate",
      ],
      evidenceRefs: [
        runtimeEvidence?.traceId ?? `${INTERNAL_RUNTIME_TRACE_PREFIX}none`,
        `subject:${subjectRaw.trim()}`,
        "host_safe_mode",
      ],
      nextStep: "use full workspace runtime for evidence-backed explain details",
    },
  };
}

function createHostSafeRouter(spine: ActivationSpine): CommandRouter {
  const notImplemented = async (command: string): Promise<CommandPayload> => ({
    ok: false,
    command,
    message: HOST_SAFE_LIMITATION_MESSAGE,
  });

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
        const action = typeof input?.action === "string" ? input.action : "show";
        if (action === "set") {
          return createUnavailableActionError(
            "HOST_SAFE_POLICY_SET_UNAVAILABLE",
            "policy set is unavailable in the host-safe plugin package",
            ["social_daily_limit", "quiet_enabled"],
            "run_workspace_runtime_or_reinstall_full_build",
          );
        }
        return notImplemented("policy");
      },
    },
    {
      name: "credential",
      description: "Inspect or recover credential state",
      execute: async (input) => {
        const action = typeof input?.action === "string" ? input.action : "show";
        if (action === "verify") {
          return createUnavailableActionError(
            "HOST_SAFE_CREDENTIAL_VERIFY_UNAVAILABLE",
            "credential verify is unavailable in the host-safe plugin package",
            ["verification_answer"],
            "run_workspace_runtime_or_reinstall_full_build",
          );
        }
        const platformId = typeof input?.platformId === "string" ? input.platformId : undefined;
        return buildCredentialPayload(platformId);
      },
    },
    {
      name: "quiet",
      description: "Inspect Quiet lifecycle state",
      execute: async (input) => {
        const scope = typeof input?.scope === "string" ? input.scope : undefined;
        return buildQuietPayload(scope);
      },
    },
    {
      name: "report",
      description: "Show daily report artifacts",
      execute: async (input) => {
        const day = typeof input?.day === "string" ? input.day : undefined;
        return buildReportPayload(day);
      },
    },
    {
      name: "session",
      description: "Inspect continuity session details",
      execute: async (input) => {
        const sessionId = typeof input?.sessionId === "string" ? input.sessionId : undefined;
        return buildSessionPayload(sessionId);
      },
    },
    {
      name: "audit",
      description: "Inspect audit and evidence views",
      execute: async () => notImplemented("audit"),
    },
    {
      name: "explain",
      description: "Answer why-question explain requests",
      execute: async (input) => {
        const subject = typeof input?.subject === "string" ? input.subject : undefined;
        return buildExplainPayload(spine, subject);
      },
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
  const spine = {
    router: undefined as unknown as CommandRouter,
    runtimeHandle: startRuntimeService({ workspaceRoot: process.cwd() }),
    lifecycleState: getLifecycleState(),
    serviceStartRecorded: false,
    runtimeEvidence: [],
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

function recordRuntimeEvidence(spine: ActivationSpine, origin: "register" | "service_start"): void {
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
  spine.runtimeHandle = startRuntimeService({ workspaceRoot: process.cwd() });
  spine.lifecycleState = recordRegistration();
  spine.serviceStartRecorded = false;
  recordRuntimeEvidence(spine, "register");
  return spine;
}

function parseCommandInput(rawArgs?: string):
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
        message: "policy set requires structured args; use second_nature_ops instead.",
      },
    };
  }

  if (command === "credential" && rest[0] === "verify") {
    return {
      ok: false,
      result: {
        ok: false,
        command,
        message: "credential verify requires structured args; use second_nature_ops instead.",
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
    case "explain":
      return {
        ok: true,
        command,
        input: rest.length > 0 ? { subject: rest.join(" ") } : undefined,
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

export default {
  id: "second-nature",
  name: "Second Nature",
  description: "Registers command/tool/service surface with load-reload lifecycle semantics.",
  register(api: RegisterApi) {
    const spine = refreshRegistrationState();
    const runtimeService = createRuntimeService();
    const lifecycleService = createLifecycleService();

    api.registerService(runtimeService);
    api.registerService(lifecycleService);

    api.registerCommand({
      name: "second-nature",
      description: "Route Agent-facing operational commands for Second Nature.",
      acceptsArgs: true,
      handler: async (ctx: { args?: string }) => {
        const parsed = parseCommandInput(ctx.args);
        if (!parsed.ok) {
          return {
            text: JSON.stringify(parsed.result),
          };
        }

        const resolved = spine.router.resolve(parsed.command);
        if (!resolved) {
          return {
            text: JSON.stringify({ ok: false, command: parsed.command, message: "Unknown Second Nature command." }),
          };
        }

        const result = await resolved.execute(parsed.input);
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
          args: { type: "object", additionalProperties: true },
        },
        required: ["command"],
      },
      async execute(_id: string, params: { command: string; args?: Record<string, unknown> }) {
        const resolved = spine.router.resolve(params.command);
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
