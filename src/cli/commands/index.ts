import type { ActionBridge } from "../action-bridge.js";
import type { OpsRouter } from "../ops/ops-router.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import fs from "node:fs";
import path from "node:path";
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

import { validateSetupAck, SETUP_ACK_SCHEMA_VERSION, type SetupAckValidationError } from "../../shared/setup-ack.js";
import {
  createDefaultHostDiscoveryPort,
  probeHostDiscovery,
  recordHostToolVisibilityLog,
} from "../host-capability/host-discovery-port.js";

const SETUP_MARKER_RELATIVE_PATH = path.join(
  ".second-nature",
  "setup",
  "agent-inner-guide-ack.json",
);

function safeShortText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, maxLen);
}

function resolveWorkspaceRoot(input?: Record<string, unknown>): string {
  if (typeof input?.workspaceRoot === "string" && input.workspaceRoot.trim().length > 0) {
    return path.resolve(input.workspaceRoot as string);
  }
  if (typeof process.env.SECOND_NATURE_WORKSPACE_ROOT === "string" && process.env.SECOND_NATURE_WORKSPACE_ROOT.trim().length > 0) {
    return path.resolve(process.env.SECOND_NATURE_WORKSPACE_ROOT);
  }
  return process.cwd();
}

function readSetupText(fileName: "SKILL.md" | "agent-inner-guide.md"): { ok: true; path: string; content: string } | { ok: false; path: string; error: string } {
  const candidates = fileName === "SKILL.md"
    ? [path.resolve(process.cwd(), "SKILL.md"), path.resolve(process.cwd(), "..", "SKILL.md")]
    : [path.resolve(process.cwd(), "plugin", "agent-inner-guide.md"), path.resolve(process.cwd(), "..", "plugin", "agent-inner-guide.md")];
  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, "utf-8");
      return { ok: true, path: candidate, content };
    } catch {
      // try next candidate
    }
  }
  return { ok: false, path: candidates[0] ?? fileName, error: `Could not read ${fileName}` };
}

function summarizeSetupText(content: string): string {
  const lines = content.split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const first = nonEmpty.slice(0, 3).join("\n");
  const marker = content.length > first.length ? "\n\n[...]" : "";
  return `${first}${marker}`;
}

function readSetupAckMarker(workspaceRoot: string): {
  status: "pending" | "acknowledged" | "incomplete";
  markerPath?: string;
  acknowledgedAt?: string;
  placedIn?: string;
  incompleteReasons?: SetupAckValidationError[];
} {
  const markerPath = path.join(workspaceRoot, SETUP_MARKER_RELATIVE_PATH);
  try {
    const raw = fs.readFileSync(markerPath, "utf-8");
    const marker = JSON.parse(raw) as Record<string, unknown>;
    if (marker.status === "acknowledged") {
      const validation = validateSetupAck(marker);
      if (validation.ok) {
        return {
          status: "acknowledged",
          markerPath,
          acknowledgedAt: validation.ack.acknowledgedAt,
          placedIn: validation.ack.placedIn,
        };
      }
      return {
        status: "incomplete",
        markerPath,
        acknowledgedAt: typeof marker.acknowledgedAt === "string" ? marker.acknowledgedAt : undefined,
        placedIn: typeof marker.placedIn === "string" ? marker.placedIn : undefined,
        incompleteReasons: validation.errors,
      };
    }
  } catch {
    // marker missing or unreadable
  }
  return { status: "pending", markerPath };
}

async function buildSetupHintPayload(input?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const format = input?.format === "full" ? "full" : "summary";
  const includeSkill = input?.includeSkill !== false;
  const includeGuide = input?.includeGuide !== false;
  const workspaceRoot = resolveWorkspaceRoot(input);
  const ack = readSetupAckMarker(workspaceRoot);
  const hostDiscovery = await probeHostDiscovery({
    port: createDefaultHostDiscoveryPort(),
    hostName: typeof input?.hostName === "string" ? input.hostName : undefined,
    hostVersion: typeof input?.hostVersion === "string" ? input.hostVersion : undefined,
  });
  await recordHostToolVisibilityLog(workspaceRoot, "setup_hint", hostDiscovery);
  const data: Record<string, unknown> = {
    status: ack.status,
    workspaceRoot,
    markerPath: ack.markerPath,
    acknowledgedAt: ack.acknowledgedAt,
    placedIn: ack.placedIn,
    hostDiscovery,
    recommendedPlacement: [
      "agent prompt",
      "workspace/IDENTITY.md",
      "workspace/USER.md",
    ],
    nextStep:
      ack.status === "acknowledged"
        ? hostDiscovery.setupComplete
          ? "setup_verified_by_host_discovery"
          : hostDiscovery.nextStep
        : ack.status === "incomplete"
          ? "repair_setup_ack_fields"
          : "read_returned_guidance_then_run_setup_ack",
    ...(ack.incompleteReasons ? { incompleteReasons: ack.incompleteReasons } : {}),
  };

  if (includeSkill) {
    const skill = readSetupText("SKILL.md");
    data.skill = skill.ok
      ? {
          path: skill.path,
          content:
            format === "full" ? skill.content : summarizeSetupText(skill.content),
        }
      : skill;
  }
  if (includeGuide) {
    const guide = readSetupText("agent-inner-guide.md");
    data.guide = guide.ok
      ? {
          path: guide.path,
          content:
            format === "full" ? guide.content : summarizeSetupText(guide.content),
        }
      : guide;
  }

  return {
    ok: true,
    command: "setup_hint",
    runtimeMode: "workspace_full_runtime",
    surfaceMode: "workspace_full_runtime",
    generatedAt: new Date().toISOString(),
    evidenceLevel: "contract_smoke",
    warnings: [],
    sourceRefs: [],
    data: {
      message:
        "Read the SKILL and guide as a friendly setup note, then place the guidance where the agent naturally checks its working anchors.",
      ...data,
    },
  };
}

async function buildSetupAckPayload(input?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRoot(input);
  const markerPath = path.join(workspaceRoot, SETUP_MARKER_RELATIVE_PATH);

  const placedIn = safeShortText(input?.placedIn, 160);
  const placementProofRef = safeShortText(input?.placementProofRef, 320);
  const writer = safeShortText(input?.writer, 80);

  const candidate: Record<string, unknown> = {
    schemaVersion: SETUP_ACK_SCHEMA_VERSION,
    acknowledgedAt: new Date().toISOString(),
    acceptedBy: safeShortText(input?.acceptedBy, 80) ?? "agent",
    placedIn: placedIn ?? "unspecified",
    placementProofRef: placementProofRef ?? "",
    note: safeShortText(input?.note, 240),
    guideVersion: "0.2.5",
    writer: writer ?? "setup_ack_command",
    source: "second-nature-cli",
    skillPath: "SKILL.md",
    guidePath: "plugin/agent-inner-guide.md",
    status: "acknowledged",
  };

  const validation = validateSetupAck(candidate);
  if (!validation.ok) {
    return {
      ok: false,
      command: "setup_ack",
      surfaceMode: "workspace_full_runtime",
      evidenceLevel: "carrier_ack",
      message: "Setup acknowledgement is incomplete; see errors and repairAction.",
      data: {
        markerPath,
        validationErrors: validation.errors,
      },
    };
  }

  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf-8");

  const hostDiscovery = await probeHostDiscovery({
    port: createDefaultHostDiscoveryPort(),
    hostName: typeof input?.hostName === "string" ? input.hostName : undefined,
    hostVersion: typeof input?.hostVersion === "string" ? input.hostVersion : undefined,
  });
  await recordHostToolVisibilityLog(workspaceRoot, "setup_ack", hostDiscovery);

  return {
    ok: true,
    command: "setup_ack",
    runtimeMode: "workspace_full_runtime",
    surfaceMode: "workspace_full_runtime",
    generatedAt: new Date().toISOString(),
    evidenceLevel: hostDiscovery.setupComplete ? "state_present" : "carrier_ack",
    warnings: hostDiscovery.setupComplete ? [] : ["host_discovery_incomplete"],
    sourceRefs: [],
    data: {
      message: hostDiscovery.setupComplete
        ? "Setup guide acknowledgement persisted and host discovery confirms tool/skill visibility."
        : "Setup guide acknowledgement persisted, but host discovery has not confirmed tool/skill visibility; see hostDiscovery.",
      markerPath,
      hostDiscovery,
      ...candidate,
    },
  };
}

export interface CliCommandDefinition {
  name: string;
  description: string;
  execute(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface CliCommandDeps {
  readModels: CliReadModels;
  actionBridge: ActionBridge;
  opsRouter: OpsRouter;
  stateDb?: StateDatabase;
  observabilityDb?: ObservabilityDatabase;
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
  const { readModels, actionBridge, opsRouter, stateDb, observabilityDb } = deps;
  const flush = () => {
    try {
      stateDb?.flush();
    } catch {
      // ignore flush errors to avoid masking command results
    }
    try {
      observabilityDb?.flush();
    } catch {
      // ignore flush errors to avoid masking command results
    }
  };
  const opsCommand = (
    name: string,
    description: string,
  ): CliCommandDefinition => ({
    name,
    description,
    execute: async (input) => {
      const surface = await Promise.resolve(opsRouter.dispatch(name, input));
      flush();
      return surface as Record<string, unknown>;
    },
  });

  return [
    {
      name: "setup_hint",
      description:
        "Return the packaged setup SKILL and agent inner guide for first-run onboarding",
      execute: async (input) => buildSetupHintPayload(input),
    },
    {
      name: "setup_ack",
      description:
        "Persist that the packaged setup guide was read and placed into working anchors",
      execute: async (input) => {
        const result = await buildSetupAckPayload(input);
        flush();
        return result;
      },
    },
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
          const result = await policySet(actionBridge, input);
          flush();
          return result;
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
        "v8 living-loop heartbeat — runs real-runtime perception/judgment/action closure",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("heartbeat_check", input),
        );
        flush();
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "heartbeat",
      description:
        "[DEPRECATED] v7 heartbeat entrypoint; alias to heartbeat_check",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("heartbeat_check", input),
        );
        flush();
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
        flush();
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
        flush();
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
        flush();
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
        flush();
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
      name: "credential",
      description:
        "T1.4.1 — inspect or verify credential health without exposing plaintext",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("credential", input),
        );
        flush();
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
        flush();
        return surface as Record<string, unknown>;
      },
    },
    {
      name: "connector_status",
      description:
        "T1.2.5 — show connector inventory status, trust, and health conflicts",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("connector_status", input),
        );
        flush();
        return surface as Record<string, unknown>;
      },
    },
    opsCommand(
      "connector:run",
      "T-ROS.C.3 — manually execute a connector capability outside heartbeat cadence",
    ),
    opsCommand(
      "loop_status",
      "T-ROS.C.1 — show v8 causal loop health: stalled stage, next action, and stage summaries",
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
    opsCommand(
      "guidance_payload",
      "T-V7C.C.4R — assemble impulse + atmosphere for a scene context",
    ),
    {
      name: "goal",
      description:
        "T1.2.4 — owner-governed goal operations: set, list, accept, reject",
      execute: async (input) => {
        const surface = await Promise.resolve(
          opsRouter.dispatch("goal", input),
        );
        flush();
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
