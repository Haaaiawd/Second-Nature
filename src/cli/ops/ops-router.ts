/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 */
import {
  heartbeatCheck,
  type HeartbeatCheckInput,
  type HeartbeatSurfaceResult,
} from "./heartbeat-surface.js";
import {
  showOperatorFallback,
  OperatorFallbackNotFoundError,
} from "./show-operator-fallback.js";
import type { CliReadModels } from "../read-models/index.js";
import type { RuntimeDecisionRecorder } from "../../observability/services/runtime-decision-recorder.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { ConnectorExecutor } from "../../core/second-nature/orchestrator/effect-dispatcher.js";
import { probeHostCapability } from "../host-capability/probe-host-capability.js";
import { recordHostCapability } from "../host-capability/record-host-capability.js";
import type {
  HostCapabilityAdapter,
  CapabilityCheckResult,
} from "../host-capability/types.js";
import { runNearRealConnectorSmoke } from "../../connectors/near-real/near-real-connector-smoke.js";
import { connectorInit } from "../commands/connector-init.js";
import { connectorStatus, connectorTest } from "../commands/connector-status.js";
import { goalCommand } from "../commands/goal.js";
import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";

function coerceProbeOnlyFlag(input?: Record<string, unknown>): boolean {
  const v = input?.probeOnly;
  return v === true || v === "true" || v === 1 || v === "1";
}

export interface OpsRouterDeps {
  /** When true, packaged runtime artifacts resolved and full graph is loadable */
  runtimeAvailable: boolean;
  /** Workspace read models: fallback view + heartbeat decision loop inputs (T1.2.2 / US-001). */
  readModels?: CliReadModels;
  /** Persists full-runtime heartbeat cycles so `loadStatus` exits the unknown baseline (T1.2.3). */
  runtimeRecorder?: RuntimeDecisionRecorder;
  /**
   * T2.2.2: state DB + workspace root for life evidence loading in full-runtime heartbeat cycles.
   * When set, `loadSnapshotInputsForWorkspaceHeartbeat` can fill `lifeEvidenceRefs` from real DB truth.
   */
  state?: StateDatabase;
  workspaceRoot?: string;
  /**
   * T1.2.8 (SN-CODE-03): observability DB for persisting capability probe reports.
   * When absent, `capability_probe` still runs but skips persistence.
   */
  observabilityDb?: ObservabilityDatabase;
  /**
   * When present, guard-allowed connector_action intents are dispatched through the
   * connector-system instead of returning connector_dispatch_unwired.
   */
  connectorExecutor?: ConnectorExecutor;
  /**
   * T1.2.3: DynamicConnectorRegistry for connector:status and connector:test commands.
   */
  registry?: DynamicConnectorRegistry;
}

/**
 * T1.2.8 — static local adapter: all checks return `unknown` when no real host is available.
 * Allows `capability_probe` to be called from CLI / workspace bridge without requiring a live host.
 */
function createStaticUnknownAdapter(): HostCapabilityAdapter {
  const now = new Date().toISOString();
  const unknownResult = (name: string): CapabilityCheckResult => ({
    name,
    verdict: "unknown",
    observedAt: now,
    reason: "static_local_probe_no_host_context",
    evidenceRefs: [],
  });
  return {
    checkPluginLoad: () => unknownResult("plugin_load"),
    checkHeartbeatBridge: () => unknownResult("heartbeat_bridge"),
    checkHeartbeatToolInvocation: () =>
      unknownResult("heartbeat_tool_invocation"),
    checkDeliveryTarget: () => ({ status: "unknown", evidenceRefs: [] }),
    checkAckDropBehavior: () => unknownResult("ack_drop"),
    checkHookSupport: () => [],
  };
}

export interface OpsRouter {
  heartbeatCheck(input: HeartbeatCheckInput): Promise<HeartbeatSurfaceResult>;
  dispatch(
    command: string,
    input?: Record<string, unknown>,
  ): Promise<HeartbeatSurfaceResult | Record<string, unknown>>;
}

export function createOpsRouter(deps: OpsRouterDeps): OpsRouter {
  return {
    heartbeatCheck: (input) =>
      heartbeatCheck({
        ...input,
        runtimeAvailable: input.runtimeAvailable ?? deps.runtimeAvailable,
        readModels: input.readModels ?? deps.readModels,
        runtimeRecorder: input.runtimeRecorder ?? deps.runtimeRecorder,
        state: input.state ?? deps.state,
        workspaceRoot: input.workspaceRoot ?? deps.workspaceRoot,
        connectorExecutor: input.connectorExecutor ?? deps.connectorExecutor,
      }),
    async dispatch(command, input) {
      if (command === "heartbeat_check") {
        const runtimeAvailable =
          typeof input?.runtimeAvailable === "boolean"
            ? input.runtimeAvailable
            : deps.runtimeAvailable;
        return heartbeatCheck({
          probeOnly: coerceProbeOnlyFlag(input),
          runtimeAvailable,
          fakeControlPlanePassthrough:
            input?.fakeControlPlanePassthrough &&
            typeof input.fakeControlPlanePassthrough === "object"
              ? (input.fakeControlPlanePassthrough as Record<string, unknown>)
              : undefined,
          readModels:
            (input as Partial<HeartbeatCheckInput> | undefined)?.readModels ??
            deps.readModels,
          runtimeRecorder:
            (input as Partial<HeartbeatCheckInput> | undefined)
              ?.runtimeRecorder ?? deps.runtimeRecorder,
          state:
            (input as Partial<HeartbeatCheckInput> | undefined)?.state ??
            deps.state,
          workspaceRoot:
            (input as Partial<HeartbeatCheckInput> | undefined)
              ?.workspaceRoot ?? deps.workspaceRoot,
          timestamp:
            typeof input?.timestamp === "string" ? input.timestamp : undefined,
          sessionContext:
            typeof input?.sessionContext === "string"
              ? input.sessionContext
              : undefined,
          scopeHint: input?.scopeHint as HeartbeatCheckInput["scopeHint"],
          connectorExecutor:
            (input as Partial<HeartbeatCheckInput> | undefined)
              ?.connectorExecutor ?? deps.connectorExecutor,
        });
      }
      if (command === "fallback") {
        const ref = typeof input?.ref === "string" ? input.ref.trim() : "";
        if (!ref) {
          return {
            ok: false,
            error: {
              code: "MISSING_FALLBACK_REF",
              message: "fallback requires args.ref (e.g. fallback:…)",
              requiredUserInput: ["ref"],
              nextStep: "reinvoke_with_ref",
            },
          };
        }
        if (!deps.readModels?.loadFallbackView) {
          return {
            ok: false,
            error: {
              code: "FALLBACK_READ_MODEL_UNAVAILABLE",
              message: "Operator fallback view requires workspace read models",
              requiredUserInput: ["ref"],
              nextStep: "wire_read_models_into_ops_router",
            },
          };
        }
        return (async () => {
          try {
            const data = await showOperatorFallback(ref, deps.readModels!);
            return { ok: true, command: "fallback" as const, data };
          } catch (error) {
            if (error instanceof OperatorFallbackNotFoundError) {
              return {
                ok: false,
                command: "fallback" as const,
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
        })();
      }
      if (command === "capability_probe") {
        // T1.2.8 (SN-CODE-03): run host capability probe with static unknown adapter (CLI context).
        // Persists report when observabilityDb is available; returns safe JSON subset.
        return (async () => {
          const adapter = createStaticUnknownAdapter();
          const docCheckedAt = new Date().toISOString();
          const report = probeHostCapability({
            adapter,
            docLinks: [],
            docCheckedAt,
          });
          if (deps.observabilityDb) {
            await recordHostCapability(deps.observabilityDb, report);
          }
          return {
            ok: true,
            command: "capability_probe" as const,
            data: {
              reportId: report.reportId,
              generatedAt: report.generatedAt,
              deliveryTarget: report.deliveryTarget,
              pluginLoad: { verdict: report.pluginLoad.verdict },
              heartbeatBridge: { verdict: report.heartbeatBridge.verdict },
              heartbeatToolInvocation: {
                verdict: report.heartbeatToolInvocation.verdict,
              },
              ackDropBehavior: { verdict: report.ackDropBehavior.verdict },
              conflictCount: report.conflictRecords.length,
              recommendedNextStep: report.recommendedNextStep,
              note: "static_local_probe: all verdicts are unknown without live host context",
            },
          };
        })();
      }
      if (command === "near_real_smoke") {
        // T3.3.2 (SN-CODE-05): wrap runNearRealConnectorSmoke as an ops surface command.
        // Requires state + observabilityDb + workspaceRoot to be wired into OpsRouterDeps.
        if (!deps.state || !deps.observabilityDb || !deps.workspaceRoot) {
          return {
            ok: false,
            command: "near_real_smoke" as const,
            error: {
              code: "NEAR_REAL_SMOKE_DEPS_UNAVAILABLE",
              message:
                "near_real_smoke requires state, observabilityDb, and workspaceRoot in OpsRouterDeps",
              nextStep: "wire_deps_into_ops_router",
            },
          };
        }
        return (async () => {
          const result = await runNearRealConnectorSmoke({
            state: deps.state!,
            observabilityDb: deps.observabilityDb!,
            workspaceRoot: deps.workspaceRoot!,
          });
          return {
            ok: true,
            command: "near_real_smoke" as const,
            data: result,
          };
        })();
      }
      if (command === "connector_init") {
        // T1.3.1 (SN-CODE-06): generate connector manifest stub.
        return (async () => {
          const result = await connectorInit({
            platformId: typeof input?.platformId === "string" ? input.platformId : "",
            family:
              typeof input?.family === "string"
                ? (input.family as "social_community" | "agent_network" | "work_platform" | "custom")
                : undefined,
            displayName: typeof input?.displayName === "string" ? input.displayName : undefined,
            runnerKind:
              typeof input?.runnerKind === "string"
                ? (input.runnerKind as
                    | "declarative_http"
                    | "declarative_a2a"
                    | "declarative_mcp"
                    | "cli_descriptor"
                    | "custom_adapter"
                    | "skill"
                    | "browser")
                : undefined,
            force: Boolean(input?.force),
            workspaceRoot: deps.workspaceRoot,
          });
          return result as unknown as Record<string, unknown>;
        })();
      }
      if (command === "connector_status") {
        return connectorStatus(deps.registry, undefined, {
          includeHealth: Boolean(input?.includeHealth),
          workspaceRoot:
            typeof input?.workspaceRoot === "string"
              ? input.workspaceRoot
              : deps.workspaceRoot,
        });
      }
      if (command === "connector_test") {
        return connectorTest(deps.registry, {
          platformId:
            typeof input?.platformId === "string" ? input.platformId : "",
          dryRun:
            input?.dryRun === false ? false : true, // default dry-run
        });
      }
      if (command === "goal") {
        const rawAction = typeof input?.action === "string" ? input.action : "list";
        const action = ["set", "list", "accept", "reject"].includes(rawAction)
          ? (rawAction as "set" | "list" | "accept" | "reject")
          : "list";
        return goalCommand(deps.state, {
          action,
          goalId: typeof input?.goalId === "string" ? input.goalId : undefined,
          description:
            typeof input?.description === "string" ? input.description : undefined,
          completionCriteria:
            typeof input?.completionCriteria === "string"
              ? input.completionCriteria
              : undefined,
          risk:
            typeof input?.risk === "string"
              ? (input.risk as "low" | "medium" | "high")
              : undefined,
          kind:
            typeof input?.kind === "string"
              ? (input.kind as "short_term" | "long_term")
              : undefined,
          statusFilter:
            typeof input?.statusFilter === "string" ? input.statusFilter : undefined,
          originFilter:
            typeof input?.originFilter === "string" ? input.originFilter : undefined,
          limit: typeof input?.limit === "number" ? input.limit : undefined,
        });
      }
      if (command === "dream:recent") {
        if (!deps.readModels) {
          return {
            ok: false,
            error: {
              code: "READ_MODELS_UNAVAILABLE",
              message: "dream:recent requires workspace read models",
              nextStep: "wire_read_models_into_ops_router",
            },
          };
        }
        const limit = typeof input?.limit === "number" ? input.limit : 5;
        const data = await deps.readModels.loadDreamRecent(limit);
        return { ok: true, data };
      }
      if (command === "cycle:recent") {
        if (!deps.readModels) {
          return {
            ok: false,
            error: {
              code: "READ_MODELS_UNAVAILABLE",
              message: "cycle:recent requires workspace read models",
              nextStep: "wire_read_models_into_ops_router",
            },
          };
        }
        const limit = typeof input?.limit === "number" ? input.limit : 5;
        const data = await deps.readModels.loadCycleRecent(limit);
        return { ok: true, data };
      }
      return {
        ok: false,
        error: {
          code: "unknown_ops_command",
          message: `Unknown ops command: ${command}`,
        },
      };
    },
  };
}
