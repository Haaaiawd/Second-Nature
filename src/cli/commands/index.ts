import type { ActionBridge } from "../action-bridge.js";
import type { OpsRouter } from "../ops/ops-router.js";
import { credentialVerify } from "./credential.js";
import { connectorInit, type ConnectorInitInput } from "./connector-init.js";
import { formatExplanation } from "../explain/format-explanation.js";
import { explainSurfaceSubject } from "../explain/explain-surface-subject.js";
import {
  showOperatorFallback,
  OperatorFallbackNotFoundError,
} from "../ops/show-operator-fallback.js";
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
  message:
    "Command shell registered. Implementation lands in later Wave tasks.",
});

function explainSubjectError(
  code: string,
  message: string,
): Record<string, unknown> {
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

export function createCliCommands(
  deps: CliCommandDeps,
): CliCommandDefinition[] {
  const { readModels, actionBridge, opsRouter } = deps;
  const opsCommand = (
    name: string,
    description: string,
  ): CliCommandDefinition => ({
    name,
    description,
    execute: async (input) => {
      const surface = await Promise.resolve(opsRouter.dispatch(name, input));
      return surface as Record<string, unknown>;
    },
  });

  return [
    {
      name: "status",
      description:
        "T1.2.6 — Show v6 aggregated Second Nature status (narrative + dream + cycles + runtime)",
      execute: async (input) => {
        const scope =
          typeof input?.scope === "string" ? input.scope : undefined;
        const data = await readModels.loadV6Status(scope);
        return { ok: true, data };
      },
    },
    {
      name: "policy",
      description: "Write or inspect policy state",
      execute: async (input) => {
        const action =
          typeof input?.action === "string" ? input.action : "show";
        if (action === "set") {
          return policySet(actionBridge, input);
        }
        // T1.2.6 (SN-CODE-01): `policy show` (default) returns the current rhythm policy
        // snapshot. Returns workspace defaults when no policy row has been persisted yet.
        const data = await readModels.loadPolicy();
        return { ok: true, data };
      },
    },
    {
      name: "credential",
      description: "Inspect or recover credential state",
      execute: async (input) => {
        const action =
          typeof input?.action === "string" ? input.action : "show";
        if (action === "verify") {
          return credentialVerify(actionBridge, input);
        }
        const platformId =
          typeof input?.platformId === "string" ? input.platformId : "unknown";
        const data = await readModels.loadCredential(platformId);
        return { ok: true, data };
      },
    },
    {
      name: "quiet",
      description: "Inspect Quiet lifecycle state",
      execute: async (input) => {
        const scope =
          typeof input?.scope === "string" ? input.scope : undefined;
        const data = await readModels.loadQuiet(scope);
        return { ok: true, data };
      },
    },
    {
      name: "report",
      description: "Show daily report artifacts",
      execute: async (input) => {
        const day =
          typeof input?.day === "string"
            ? input.day
            : new Date().toISOString().slice(0, 10);
        const data = await readModels.loadDailyReport(day);
        return { ok: true, data };
      },
    },
    {
      name: "session",
      description: "Inspect continuity session details",
      execute: async (input) => {
        const sessionId =
          typeof input?.sessionId === "string" ? input.sessionId : "";
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
      execute: async () => {
        // T1.2.7 (SN-CODE-02): minimal read-side view — list all in-memory audit events.
        // Empty store returns { totalEvents: 0, events: [] } (honest empty, not an error).
        const data = await readModels.loadAuditSummary();
        return { ok: true, data };
      },
    },
    {
      name: "explain",
      description: "Answer why-question explain requests",
      execute: async (input) => {
        const subjectRaw =
          typeof input?.subject === "string" ? input.subject.trim() : "";
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
            return explainSubjectError(
              "EXPLAIN_SUBJECT_REQUIRES_ID",
              "subject must include identifier",
            );
          }
          if (code === "explain_subject_unsupported") {
            return explainSubjectError(
              "EXPLAIN_SUBJECT_UNSUPPORTED",
              "supported subjects include decision:, platform:, outreach:, soul:, fallback:, delivery:, probe:, report:, source:, relationship:",
            );
          }
          return explainSubjectError(
            "EXPLAIN_SUBJECT_INVALID",
            "invalid explain subject",
          );
        }
        return {
          ok: true,
          data: formatExplanation(model),
        };
      },
    },
    {
      name: "heartbeat_check",
      description:
        "Workspace heartbeat_check ops surface (v5 HeartbeatSurfaceResult)",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("heartbeat_check", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "storage_smoke",
      description:
        "T4.1.4 — report sql.js vs native SQLite probe and optional artifact→index repair fixture",
      execute: async (input) => {
        const runRepairFixture = Boolean(input?.runRepairFixture);
        const workspaceRoot =
          typeof input?.workspaceRoot === "string"
            ? input.workspaceRoot
            : undefined;
        const data = await runStorageModeSmoke({
          runRepairFixture,
          workspaceRoot,
        });
        return { ok: true, data };
      },
    },
    {
      name: "fallback",
      description:
        "Operator-visible delivery fallback view (status always not_sent)",
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
    {
      name: "capability_probe",
      description:
        "T1.2.8 — probe host capabilities and persist report (static unknown adapter in CLI context)",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("capability_probe", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "near_real_smoke",
      description:
        "T3.3.2 — run near-real connector smoke (sentinel Moltbook + EvoMap, no live HTTP)",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("near_real_smoke", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "connector_init",
      description:
        "T1.3.1 — generate connector manifest stub under .second-nature/connectors/{platformId}/",
      execute: async (input) => {
        const result = await connectorInit({
          platformId:
            typeof input?.platformId === "string" ? input.platformId : "",
          family:
            typeof input?.family === "string"
              ? (input.family as ConnectorInitInput["family"])
              : undefined,
          displayName:
            typeof input?.displayName === "string"
              ? input.displayName
              : undefined,
          runnerKind:
            typeof input?.runnerKind === "string"
              ? (input.runnerKind as ConnectorInitInput["runnerKind"])
              : undefined,
          force: Boolean(input?.force),
          workspaceRoot:
            typeof input?.workspaceRoot === "string"
              ? input.workspaceRoot
              : undefined,
        });
        return result as unknown as Record<string, unknown>;
      },
    },
    {
      name: "connector_behavior_add",
      description:
        "Add a workspace-defined connector behavior to an existing manifest without executing custom code",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("connector_behavior_add", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "connector_status",
      description:
        "T1.2.3 — show connector inventory, trust/executable/conflict summary",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("connector_status", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "connector_test",
      description:
        "T1.2.3 — dry-run test a connector by platformId (default dry-run)",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("connector_test", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    opsCommand(
      "connector:run",
      "T-ROS.C.3 — manually execute a connector capability outside heartbeat cadence",
    ),
    opsCommand(
      "self_health",
      "T-ROS.C.1 — show v7 self-health snapshot and degraded dimensions",
    ),
    opsCommand(
      "tool_affordance",
      "T-ROS.C.1 — show v7 tool affordance map or explicit unavailable state",
    ),
    opsCommand(
      "heartbeat_digest",
      "T-ROS.C.1 — assemble v7 heartbeat digest for a day",
    ),
    opsCommand(
      "snapshot:capture",
      "T-V7C.C.1 — capture restore snapshot and narrative timeline version",
    ),
    opsCommand(
      "narrative:diff",
      "T-ROS.C.1 — compare two narrative timeline versions",
    ),
    opsCommand(
      "timeline",
      "T-ROS.C.1 — query v7 narrative timeline with cursor pagination",
    ),
    opsCommand(
      "restore",
      "T-ROS.C.1 — apply bounded restore and write restore audit",
    ),
    opsCommand(
      "runtime_secret_bootstrap",
      "T-ROS.C.1 — inspect runtime secret anchor health without exposing plaintext",
    ),
    {
      name: "goal",
      description:
        "T1.2.4 — owner-governed goal operations: set, list, accept, reject",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("goal", input),
        );
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "narrative",
      description:
        "T1.2.1 — show current NarrativeState: focus, progress, next intent, source refs, grounding status",
      execute: async (input) => {
        const narrativeId =
          typeof input?.narrativeId === "string" ? input.narrativeId : undefined;
        const data = await readModels.loadNarrative(narrativeId);
        return { ok: true, data };
      },
    },
    {
      name: "dream:recent",
      description:
        "T1.2.2 — show recent Dream run results, candidate/accepted status, fallback/partial summary",
      execute: async (input) => {
        const limit =
          typeof input?.limit === "number" ? input.limit : 5;
        const data = await readModels.loadDreamRecent(limit);
        return { ok: true, data };
      },
    },
    {
      name: "cycle:recent",
      description:
        "T1.2.5 — aggregate recent heartbeat, narrative, Dream, delivery, connector cycle summary",
      execute: async (input) => {
        const limit =
          typeof input?.limit === "number" ? input.limit : 5;
        const data = await readModels.loadCycleRecent(limit);
        return { ok: true, data };
      },
    },
  ];
}
