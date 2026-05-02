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
import { startRuntimeService, } from "./runtime/core/second-nature/runtime/service-entry.js";
import { getLifecycleState, recordRegistration, } from "./runtime/core/second-nature/runtime/lifecycle-service.js";
const INTERNAL_RUNTIME_TRACE_PREFIX = "sn-runtime-";
const HOST_SAFE_LIMITATION_MESSAGE = "Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.";
let activationSpine = null;
function trimRuntimeEvidence(spine) {
    if (spine.runtimeEvidence.length > 12) {
        spine.runtimeEvidence.splice(0, spine.runtimeEvidence.length - 12);
    }
}
function latestRuntimeEvidence(spine) {
    return spine.runtimeEvidence[spine.runtimeEvidence.length - 1];
}
function createUnavailableActionError(code, message, requiredUserInput, nextStep) {
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
function parseExplainSubject(subjectRaw) {
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
function buildStatusPayload(spine) {
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
function buildQuietPayload(scope) {
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
function buildReportPayload(day) {
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
function buildSessionPayload(sessionId) {
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
function buildCredentialPayload(platformId) {
    return {
        ok: true,
        data: {
            platformId: platformId && platformId.trim() ? platformId : "unknown",
            status: "missing",
            nextStep: "provide_credential_context",
        },
    };
}
function buildExplainPayload(spine, subjectRaw) {
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
    }
    catch (error) {
        const code = error.message;
        if (code === "explain_subject_requires_id") {
            return createUnavailableActionError("EXPLAIN_SUBJECT_REQUIRES_ID", "subject must include identifier", ["subject"], "reinvoke_explain_with_supported_subject");
        }
        if (code === "explain_subject_unsupported") {
            return createUnavailableActionError("EXPLAIN_SUBJECT_UNSUPPORTED", "supported subjects include decision:, platform:, outreach:, soul:, fallback:, delivery:, probe:, report:, source:", ["subject"], "reinvoke_explain_with_supported_subject");
        }
        return createUnavailableActionError("EXPLAIN_SUBJECT_INVALID", "invalid explain subject", ["subject"], "reinvoke_explain_with_supported_subject");
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
async function buildStorageSmokePayload(input) {
    try {
        const mod = await import("./runtime/storage/bootstrap/storage-mode-smoke.js");
        const runRepairFixture = Boolean(input?.runRepairFixture);
        const workspaceRoot = typeof input?.workspaceRoot === "string" ? input.workspaceRoot : undefined;
        const data = await mod.runStorageModeSmoke({ runRepairFixture, workspaceRoot });
        return { ok: true, data };
    }
    catch (error) {
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
function buildFallbackHostSafePayload(ref) {
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
    return createUnavailableActionError("HOST_SAFE_FALLBACK_VIEW_UNAVAILABLE", "Operator fallback view requires workspace state database; host-safe plugin cannot read persisted fallback artifacts.", ["ref"], "run_workspace_second_nature_cli_or_full_runtime_package");
}
function buildHeartbeatCheckPayload(spine, input) {
    const runtimeEvidence = latestRuntimeEvidence(spine);
    const updatedAt = runtimeEvidence?.createdAt ?? new Date(spine.lifecycleState.lastChangedAt).toISOString();
    const timestamp = typeof input?.timestamp === "string" && input.timestamp.trim().length > 0 ? input.timestamp : updatedAt;
    return {
        ok: true,
        status: "heartbeat_ok",
        heartbeat: "HEARTBEAT_OK",
        scope: "rhythm",
        trigger: "heartbeat_bridge",
        reasons: ["host_safe_bridge_ready"],
        nextAction: "continue",
        message: "Host-safe heartbeat bridge acknowledged the round. No additional action is required from this surface.",
        data: {
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
                sessionContextProvided: typeof input?.sessionContext === "string" && input.sessionContext.trim().length > 0,
                heartbeatChecklistProvided: typeof input?.heartbeatChecklist === "string" && input.heartbeatChecklist.trim().length > 0,
                serviceEntryMode: "runtime_carrier_only",
            },
        },
    };
}
function createHostSafeRouter(spine) {
    const notImplemented = async (command) => ({
        ok: false,
        command,
        message: HOST_SAFE_LIMITATION_MESSAGE,
    });
    const commands = [
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
                    return createUnavailableActionError("HOST_SAFE_POLICY_SET_UNAVAILABLE", "policy set is unavailable in the host-safe plugin package", ["social_daily_limit", "quiet_enabled"], "run_workspace_runtime_or_reinstall_full_build");
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
                    return createUnavailableActionError("HOST_SAFE_CREDENTIAL_VERIFY_UNAVAILABLE", "credential verify is unavailable in the host-safe plugin package", ["verification_answer"], "run_workspace_runtime_or_reinstall_full_build");
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
        {
            name: "heartbeat_check",
            description: "Acknowledge the shipping heartbeat bridge round",
            execute: async (input) => buildHeartbeatCheckPayload(spine, input),
        },
        {
            name: "fallback",
            description: "Operator-visible delivery fallback view (full workspace runtime required)",
            execute: async (input) => {
                const ref = typeof input?.ref === "string" ? input.ref.trim() : undefined;
                return buildFallbackHostSafePayload(ref);
            },
        },
        {
            name: "storage_smoke",
            description: "T4.1.4 storage mode smoke report (sql.js vs native probe)",
            execute: async (input) => buildStorageSmokePayload(input),
        },
    ];
    return {
        commands,
        resolve(name) {
            return commands.find((command) => command.name === name);
        },
    };
}
function createActivationSpine() {
    const spine = {
        router: undefined,
        runtimeHandle: startRuntimeService({ workspaceRoot: process.cwd() }),
        lifecycleState: getLifecycleState(),
        serviceStartRecorded: false,
        runtimeEvidence: [],
    };
    spine.router = createHostSafeRouter(spine);
    return spine;
}
function ensureActivationSpine() {
    if (activationSpine) {
        return activationSpine;
    }
    activationSpine = createActivationSpine();
    return activationSpine;
}
function recordRuntimeEvidence(spine, origin) {
    if (origin === "service_start" && spine.serviceStartRecorded) {
        return;
    }
    if (origin === "service_start") {
        spine.serviceStartRecorded = true;
    }
    spine.runtimeEvidence.push({
        traceId: `${INTERNAL_RUNTIME_TRACE_PREFIX}${origin}-${spine.lifecycleState.registerCount}-${Date.now()}`,
        capability: origin === "register"
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
function refreshRegistrationState() {
    const spine = ensureActivationSpine();
    spine.runtimeHandle = startRuntimeService({ workspaceRoot: process.cwd() });
    spine.lifecycleState = recordRegistration();
    spine.serviceStartRecorded = false;
    recordRuntimeEvidence(spine, "register");
    return spine;
}
function parseCommandInput(rawArgs) {
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
        case "heartbeat_check":
            return {
                ok: true,
                command,
                input: rest.length > 0
                    ? {
                        timestamp: rest[0],
                        sessionContext: rest.length > 1 ? rest.slice(1).join(" ") : undefined,
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
    register(api) {
        const runtimeService = createRuntimeService();
        const lifecycleService = createLifecycleService();
        api.registerService(runtimeService);
        api.registerService(lifecycleService);
        api.registerCommand({
            name: "second-nature",
            description: "Route Agent-facing operational commands for Second Nature.",
            acceptsArgs: true,
            handler: async (ctx) => {
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
            async execute(_id, params) {
                const spine = ensureActivationSpine();
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
