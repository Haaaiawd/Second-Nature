import type { ActionBridge } from "../action-bridge.js";
import type { OpsRouter } from "../ops/ops-router.js";
import { credentialVerify } from "./credential.js";
import { formatExplanation } from "../explain/format-explanation.js";
import { explainSurfaceSubject } from "../explain/explain-surface-subject.js";
import { showOperatorFallback, OperatorFallbackNotFoundError } from "../ops/show-operator-fallback.js";
import { runStorageModeSmoke } from "../../storage/bootstrap/storage-mode-smoke.js";
import { policySet } from "./policy.js";
import type { CliReadModels } from "../read-models/index.js";

export interface CliCommandDefinition {
  name: string;
  description: string;
  execute(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface CliCommandDeps {
  readModels: CliReadModels;
  actionBridge: ActionBridge;
  opsRouter: OpsRouter;
}

const notImplemented = async (command: string) => ({
  ok: false,
  command,
  message: "Command shell registered. Implementation lands in later Wave tasks.",
});

function explainSubjectError(code: string, message: string): Record<string, unknown> {
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

export function createCliCommands(deps: CliCommandDeps): CliCommandDefinition[] {
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

        let model;
        try {
          model = await explainSurfaceSubject(subjectRaw, readModels);
        } catch (error) {
          const code = (error as Error).message;
          if (code === "explain_subject_requires_id") {
            return explainSubjectError("EXPLAIN_SUBJECT_REQUIRES_ID", "subject must include identifier");
          }
          if (code === "explain_subject_unsupported") {
            return explainSubjectError(
              "EXPLAIN_SUBJECT_UNSUPPORTED",
              "supported subjects include decision:, platform:, outreach:, soul:, fallback:, delivery:, probe:, report:, source:",
            );
          }
          return explainSubjectError("EXPLAIN_SUBJECT_INVALID", "invalid explain subject");
        }
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
        const surface = await Promise.resolve(opsRouter.dispatch("heartbeat_check", input));
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "storage_smoke",
      description: "T4.1.4 — report sql.js vs native SQLite probe and optional artifact→index repair fixture",
      execute: async (input) => {
        const runRepairFixture = Boolean(input?.runRepairFixture);
        const workspaceRoot = typeof input?.workspaceRoot === "string" ? input.workspaceRoot : undefined;
        const data = await runStorageModeSmoke({ runRepairFixture, workspaceRoot });
        return { ok: true, data };
      },
    },
    {
      name: "fallback",
      description: "Operator-visible delivery fallback view (status always not_sent)",
      execute: async (input) => {
        const ref = typeof input?.ref === "string" ? input.ref.trim() : "";
        if (!ref) {
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
        try {
          const data = await showOperatorFallback(ref, readModels);
          return { ok: true, data };
        } catch (error) {
          if (error instanceof OperatorFallbackNotFoundError) {
            return {
              ok: false,
              error: {
                code: error.code,
                message: error.message,
                requiredUserInput: ["ref"],
                nextStep: "verify_fallback_ref_from_delivery_audit",
              },
            };
          }
          throw error;
        }
      },
    },
  ];
}
