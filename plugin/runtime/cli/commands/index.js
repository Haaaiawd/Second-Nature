import { credentialVerify } from "./credential.js";
import { formatExplanation } from "../explain/format-explanation.js";
import { resolveExplainSubject } from "../explain/resolve-subject.js";
import { policySet } from "./policy.js";
const notImplemented = async (command) => ({
    ok: false,
    command,
    message: "Command shell registered. Implementation lands in later Wave tasks.",
});
function explainSubjectError(code, message) {
    return {
        ok: false,
        error: {
            code,
            message,
            requiredUserInput: ["subject"],
            nextStep: "reinvoke_explain_with_supported_subject",
        },
    };
}
export function createCliCommands(deps) {
    const { readModels, actionBridge, opsRouter } = deps;
    return [
        {
            name: "status",
            description: "Show aggregated Second Nature status",
            execute: async (input) => {
                const scope = typeof input?.scope === "string" ? input.scope : undefined;
                const data = await readModels.loadStatus(scope);
                return { ok: true, data };
            },
        },
        {
            name: "policy",
            description: "Write or inspect policy state",
            execute: async (input) => {
                const action = typeof input?.action === "string" ? input.action : "show";
                if (action === "set") {
                    return policySet(actionBridge, input);
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
                    return credentialVerify(actionBridge, input);
                }
                const platformId = typeof input?.platformId === "string" ? input.platformId : "unknown";
                const data = await readModels.loadCredential(platformId);
                return { ok: true, data };
            },
        },
        {
            name: "quiet",
            description: "Inspect Quiet lifecycle state",
            execute: async (input) => {
                const scope = typeof input?.scope === "string" ? input.scope : undefined;
                const data = await readModels.loadQuiet(scope);
                return { ok: true, data };
            },
        },
        {
            name: "report",
            description: "Show daily report artifacts",
            execute: async (input) => {
                const day = typeof input?.day === "string" ? input.day : new Date().toISOString().slice(0, 10);
                const data = await readModels.loadDailyReport(day);
                return { ok: true, data };
            },
        },
        {
            name: "session",
            description: "Inspect continuity session details",
            execute: async (input) => {
                const sessionId = typeof input?.sessionId === "string" ? input.sessionId : "";
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
                const data = await readModels.loadSession(sessionId);
                return { ok: true, data };
            },
        },
        {
            name: "audit",
            description: "Inspect audit and evidence views",
            execute: () => notImplemented("audit"),
        },
        {
            name: "explain",
            description: "Answer why-question explain requests",
            execute: async (input) => {
                const subjectRaw = typeof input?.subject === "string" ? input.subject.trim() : "";
                if (!subjectRaw) {
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
                    subject = resolveExplainSubject(subjectRaw);
                }
                catch (error) {
                    const code = error.message;
                    if (code === "explain_subject_requires_id") {
                        return explainSubjectError("EXPLAIN_SUBJECT_REQUIRES_ID", "subject must include identifier");
                    }
                    if (code === "explain_subject_unsupported") {
                        return explainSubjectError("EXPLAIN_SUBJECT_UNSUPPORTED", "supported subjects are decision:<id>, platform:<id>, outreach:<id>, soul:<id>");
                    }
                    return explainSubjectError("EXPLAIN_SUBJECT_INVALID", "invalid explain subject");
                }
                const model = await readModels.explain(subject);
                return {
                    ok: true,
                    data: formatExplanation(model),
                };
            },
        },
        {
            name: "heartbeat_check",
            description: "Workspace heartbeat_check ops surface (v5 HeartbeatSurfaceResult)",
            execute: async (input) => {
                const surface = opsRouter.dispatch("heartbeat_check", input);
                return surface;
            },
        },
    ];
}
