/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 *
 * v7 additions (T-ROS.C.1): self_health, tool_affordance, connector_test --wet,
 * heartbeat_digest, narrative:diff, timeline, restore, runtime_secret_bootstrap.
 * All commands return RuntimeOpsEnvelope.
 */
import fs from "node:fs";
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
import { connectorBehaviorAdd } from "../commands/connector-behavior.js";
import { connectorStatus, connectorTest } from "../commands/connector-status.js";
import { goalCommand } from "../commands/goal.js";
import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";
// v7 observability services (T-ROS.C.1)
import {
  getSelfHealthSnapshot,
  ensureMinimumProbes,
} from "../../observability/services/self-health-snapshot.js";
import {
  generateHeartbeatDigest,
  type HeartbeatDigestAssemblerDeps,
} from "../../observability/services/heartbeat-digest-assembler.js";
import {
  queryNarrativeTimeline,
  queryNarrativeDiff,
  type NarrativeTimelineDeps,
} from "../../observability/services/narrative-timeline-query-service.js";
import {
  viewSecretAnchor,
  type SecretAnchorDeps,
} from "../../observability/services/runtime-secret-anchor-view.js";
import {
  writeRestoreAudit,
  type RestoreAuditEvent,
} from "../../observability/services/restore-audit-service.js";
import { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import type { RestoreSnapshotStore } from "../../storage/services/restore-snapshot-store.js";
// T-ROS.C.3: ManualRunDispatcher and its deps
import {
  createManualRunDispatcher,
  type ManualRunDispatcher,
} from "./manual-run-dispatcher.js";
import { createExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import { createToolExperienceStore } from "../../storage/services/tool-experience-store.js";
import { createWetProbeRunner } from "../../connectors/base/wet-probe-runner.js";
import { CapabilityContractRegistryV7 } from "../../connectors/base/manifest-v7.js";

// ─── RuntimeOpsEnvelope (T-ROS.C.1 / [G1]) ───────────────────────────────────

/** Unified response envelope for all v7 runtime-ops commands. */
export interface RuntimeOpsEnvelope<T = unknown> {
  ok: boolean;
  command: string;
  runtimeMode: "host_safe_carrier" | "workspace_full_runtime" | "unavailable";
  surfaceMode: "cli" | "openclaw_tool" | "plugin_command" | "cron_probe";
  generatedAt: string;
  data?: T;
  error?: { code: string; message: string; nextStep?: string };
  warnings: string[];
  sourceRefs: string[];
}

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
  // ─── v7 observability ports (T-ROS.C.1) ──────────────────────────────────
  /**
   * In-memory audit store for heartbeat_digest, restore, and audit commands.
   * When absent, commands degrade gracefully.
   */
  auditStore?: AppendOnlyAuditStore;
  /**
   * Deps for heartbeat_digest — includes optional stateMemoryPort and deliveryAdapter.
   * When absent, only auditStore is used (no state-memory enrichment).
   */
  heartbeatDigestDeps?: Omit<HeartbeatDigestAssemblerDeps, "auditStore">;
  /**
   * Deps for narrative timeline (narrative:diff, timeline commands).
   */
  narrativeTimelineDeps?: NarrativeTimelineDeps;
  /**
   * Deps for runtime_secret_bootstrap (key anchor health check).
   */
  secretAnchorDeps?: SecretAnchorDeps;
  /**
   * T-ROS.C.1: RestoreSnapshotStore for bounded state restoration.
   * When absent, restore command degrades to audit-only.
   */
  restoreSnapshotStore?: RestoreSnapshotStore;
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
  ): Promise<HeartbeatSurfaceResult | Record<string, unknown> | RuntimeOpsEnvelope>;
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
      if (command === "connector_behavior_add") {
        return connectorBehaviorAdd({
          platformId: typeof input?.platformId === "string" ? input.platformId : "",
          behaviorId:
            typeof input?.behaviorId === "string"
              ? input.behaviorId
              : typeof input?.capabilityId === "string"
                ? input.capabilityId
                : "",
          description:
            typeof input?.description === "string" ? input.description : undefined,
          channel: typeof input?.channel === "string" ? input.channel : undefined,
          sourceRefs: input?.sourceRefs,
          observedCount:
            typeof input?.observedCount === "number" ? input.observedCount : undefined,
          workspaceRoot:
            typeof input?.workspaceRoot === "string"
              ? input.workspaceRoot
              : deps.workspaceRoot,
        }) as unknown as Record<string, unknown>;
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
        // v7 T-ROS.C.1: --wet flag (wet=true) sets dryRun=false + marks triggerSource:"manual_run"
        const isWet = input?.wet === true || input?.wet === "true";
        const result = await connectorTest(deps.registry, {
          platformId:
            typeof input?.platformId === "string" ? input.platformId : "",
          dryRun: isWet ? false : (input?.dryRun === false ? false : true),
        });
        if (isWet && result.ok) {
          // Annotate result with manual trigger context (DR-038 / T-ROS.C.3)
          (result as Record<string, unknown>).triggerSource = "manual_run";
          (result as Record<string, unknown>).affectsHeartbeatCadence = false;
        }
        return result;
      }
      if (command === "connector:run") {
        // T-ROS.C.3: manual connector execution — isolated from heartbeat cadence
        const platformId =
          typeof input?.platformId === "string" ? input.platformId : "";
        const capabilityId =
          typeof input?.capabilityId === "string" ? input.capabilityId : "";
        if (!platformId || !capabilityId) {
          return {
            ok: false,
            command: "connector:run" as const,
            error: {
              code: "MISSING_PLATFORM_OR_CAPABILITY_ID",
              message: "connector:run requires platformId and capabilityId",
              requiredUserInput: ["platformId", "capabilityId"],
              nextStep: "reinvoke_with_platform_and_capability_id",
            },
          };
        }
        if (!deps.connectorExecutor || !deps.state) {
          return {
            ok: false,
            command: "connector:run" as const,
            error: {
              code: "MANUAL_RUN_DEPS_UNAVAILABLE",
              message: "connector:run requires connectorExecutor and state database",
              nextStep: "wire_connector_executor_and_state_into_ops_router",
            },
          };
        }
        const toolExperienceStore = createToolExperienceStore(deps.state);
        const experienceWriter = createExperienceWriter(toolExperienceStore);
        const wetProbeRunner = createWetProbeRunner();
        const registryV7 = new CapabilityContractRegistryV7();
        // Populate V7 registry from dynamic registry if available (best-effort)
        if (deps.registry) {
          for (const entry of deps.registry.listConnectors()) {
            if (entry.manifestPath) {
              try {
                const manifestText = fs.readFileSync(entry.manifestPath, "utf-8");
                const manifest = JSON.parse(manifestText) as Record<string, unknown>;
                registryV7.register(manifest);
              } catch {
                // Skip manifests that can't be read or don't validate as V7
              }
            }
          }
        }
        const dispatcher = createManualRunDispatcher({
          connectorExecutor: deps.connectorExecutor,
          experienceWriter,
          wetProbeRunner,
          registryV7,
        });
        return dispatcher.runConnector({
          platformId,
          capabilityId,
          payload:
            typeof input?.payload === "object" && input?.payload !== null
              ? (input.payload as Record<string, unknown>)
              : undefined,
          caller: typeof input?.caller === "string" ? input.caller : undefined,
          reason: typeof input?.reason === "string" ? input.reason : undefined,
        });
      }
      if (command === "goal") {
        const rawAction = typeof input?.action === "string" ? input.action : "list";
        const action = ["set", "list", "accept", "reject"].includes(rawAction)
          ? (rawAction as "set" | "list" | "accept" | "reject")
          : "list";
        const sanitizeText = (v: unknown, maxLen = 1000): string | undefined => {
          if (typeof v !== "string") return undefined;
          const trimmed = v.trim();
          if (trimmed.length === 0) return undefined;
          return trimmed.slice(0, maxLen);
        };
        return goalCommand(deps.state, {
          action,
          goalId: typeof input?.goalId === "string" ? input.goalId.trim().slice(0, 128) : undefined,
          description: sanitizeText(input?.description),
          completionCriteria: sanitizeText(input?.completionCriteria),
          // T1.4.2: criteria alias for completionCriteria
          criteria: sanitizeText(input?.criteria),
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

      // ─── v7 commands (T-ROS.C.1) ─────────────────────────────────────────

      /** [G2] self_health — transparent pass-through from SelfHealthSnapshot (DR-042). */
      if (command === "self_health") {
        const generatedAt = new Date().toISOString();
        try {
          ensureMinimumProbes();
          const snap = await getSelfHealthSnapshot();
          const degraded_dimensions = Object.entries(snap.dimensions)
            .filter(([, d]) => d.status === "degraded")
            .map(([k]) => k);
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "self_health",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data: {
              overall: snap.overall,
              generatedAt: snap.generatedAt,
              degraded_dimensions,
              dimensions: snap.dimensions,
            },
            warnings: [],
            sourceRefs: ["observability/services/self-health-snapshot.ts"],
          };
          return envelope;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "self_health",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: { code: "SELF_HEALTH_PROBE_FAILED", message: msg },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
      }

      /**
       * [G3] tool_affordance — body-tool AffordanceMap pass-through.
       * Port not yet wired in this wave; returns degraded view with clear next-step.
       */
      if (command === "tool_affordance") {
        const generatedAt = new Date().toISOString();
        const envelope: RuntimeOpsEnvelope = {
          ok: false,
          command: "tool_affordance",
          runtimeMode: "unavailable",
          surfaceMode: "cli",
          generatedAt,
          error: {
            code: "TOOL_AFFORDANCE_PORT_UNWIRED",
            message: "tool_affordance requires body-tool AffordanceMap port (T-BTS.C.1) to be wired into OpsRouterDeps",
            nextStep: "wire_body_tool_port_into_ops_router_deps",
          },
          warnings: [],
          sourceRefs: [],
        };
        return envelope;
      }

      /**
       * [G6] heartbeat_digest — wraps generateHeartbeatDigest.
       * Requires auditStore in deps; degrades if unavailable.
       */
      if (command === "heartbeat_digest") {
        const generatedAt = new Date().toISOString();
        if (!deps.auditStore) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "heartbeat_digest",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "AUDIT_STORE_UNAVAILABLE",
              message: "heartbeat_digest requires auditStore in OpsRouterDeps",
              nextStep: "wire_audit_store_into_ops_router",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        const date =
          typeof input?.date === "string" && input.date
            ? input.date
            : new Date().toISOString().slice(0, 10);
        try {
          const digestDeps = {
            auditStore: deps.auditStore,
            ...deps.heartbeatDigestDeps,
          };
          const digest = await generateHeartbeatDigest(date, digestDeps);
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "heartbeat_digest",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data: digest,
            warnings: [],
            sourceRefs: ["observability/services/heartbeat-digest-assembler.ts"],
          };
          return envelope;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "heartbeat_digest",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: { code: "DIGEST_GENERATION_FAILED", message: msg },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
      }

      /**
       * [G6] narrative:diff — queryNarrativeDiff between two versions.
       * Requires narrativeTimelineDeps in OpsRouterDeps.
       */
      if (command === "narrative:diff") {
        const generatedAt = new Date().toISOString();
        if (!deps.narrativeTimelineDeps) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "narrative:diff",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "NARRATIVE_TIMELINE_PORT_UNAVAILABLE",
              message: "narrative:diff requires narrativeTimelineDeps in OpsRouterDeps",
              nextStep: "wire_narrative_timeline_deps_into_ops_router",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        const fromVersion = typeof input?.from === "string" ? input.from : "";
        const toVersion = typeof input?.to === "string" ? input.to : "";
        if (!fromVersion || !toVersion) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "narrative:diff",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "MISSING_VERSIONS",
              message: "narrative:diff requires 'from' and 'to' version arguments",
              nextStep: "reinvoke_with_from_and_to",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        try {
          const diff = await queryNarrativeDiff(fromVersion, toVersion, deps.narrativeTimelineDeps);
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "narrative:diff",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data: diff,
            warnings: [],
            sourceRefs: ["observability/services/narrative-timeline-query-service.ts"],
          };
          return envelope;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "narrative:diff",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: { code: "NARRATIVE_DIFF_FAILED", message: msg },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
      }

      /**
       * [G6] timeline — queryNarrativeTimeline with cursor pagination.
       * Requires narrativeTimelineDeps in OpsRouterDeps.
       */
      if (command === "timeline") {
        const generatedAt = new Date().toISOString();
        if (!deps.narrativeTimelineDeps) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "timeline",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "NARRATIVE_TIMELINE_PORT_UNAVAILABLE",
              message: "timeline requires narrativeTimelineDeps in OpsRouterDeps",
              nextStep: "wire_narrative_timeline_deps_into_ops_router",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        const now = new Date();
        const to = typeof input?.to === "string" ? input.to : now.toISOString();
        const from =
          typeof input?.from === "string"
            ? input.from
            : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const limit = typeof input?.limit === "number" ? input.limit : 20;
        const cursor = typeof input?.cursor === "string" ? input.cursor : undefined;
        try {
          const page = await queryNarrativeTimeline(from, to, { limit, cursor }, deps.narrativeTimelineDeps);
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "timeline",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data: page,
            warnings: [],
            sourceRefs: ["observability/services/narrative-timeline-query-service.ts"],
          };
          return envelope;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const code = (err as { name?: string }).name === "NarrativeQueryRangeError"
            ? "NARRATIVE_RANGE_EXCEEDED"
            : "TIMELINE_QUERY_FAILED";
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "timeline",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: { code, message: msg },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
      }

      /**
       * [G6] restore — bounded state restoration via RestoreSnapshotStore + audit (T-ROS.C.1, T-OBS.C.6).
       * When restoreSnapshotStore is wired, attempts to apply the snapshot payload back to state.
       * Always writes RestoreAudit. Never restores credential fields.
       */
      if (command === "restore") {
        const generatedAt = new Date().toISOString();
        if (!deps.auditStore) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "restore",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "AUDIT_STORE_UNAVAILABLE",
              message: "restore requires auditStore in OpsRouterDeps",
              nextStep: "wire_audit_store_into_ops_router",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        const missingFields: string[] = [];
        if (typeof input?.restoreTarget !== "string") missingFields.push("restoreTarget");
        if (typeof input?.fromVersion !== "string") missingFields.push("fromVersion");
        if (typeof input?.toVersion !== "string") missingFields.push("toVersion");
        if (missingFields.length > 0) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "restore",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "MISSING_RESTORE_FIELDS",
              message: `restore requires: ${missingFields.join(", ")}`,
              nextStep: "reinvoke_with_required_fields",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }

        // [NEW] Invoke bounded restore via RestoreSnapshotStore when wired
        let restoreResult: {
          ok: boolean;
          completedEntities: string[];
          failedEntities: string[];
          warnings: string[];
        } = {
          ok: false,
          completedEntities: [],
          failedEntities: [],
          warnings: ["restore_snapshot_store_unavailable"],
        };
        if (deps.restoreSnapshotStore) {
          restoreResult = await deps.restoreSnapshotStore.applyBoundedRestore({
            restoreTarget: input!.restoreTarget as string,
            fromVersion: input!.fromVersion as string,
            toVersion: input!.toVersion as string,
          });
        }

        const event: RestoreAuditEvent = {
          id: `restore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          restoreTarget: input!.restoreTarget as RestoreAuditEvent["restoreTarget"],
          fromVersion: input!.fromVersion as string,
          toVersion: input!.toVersion as string,
          triggeredBy: (input?.triggeredBy as RestoreAuditEvent["triggeredBy"]) ?? "operator",
          reason: typeof input?.reason === "string" ? input.reason : "manual_restore",
          completedEntities: restoreResult.completedEntities,
          failedEntities: restoreResult.failedEntities,
          // credentials are always excluded from restore audit
          excludedFields: Array.isArray(input?.excludedFields)
            ? (input!.excludedFields as string[]).filter((f) => typeof f === "string")
            : ["credential", "encryptionKey"],
          restoredFieldCount: restoreResult.completedEntities.length,
          createdAt: generatedAt,
          traceId: typeof input?.traceId === "string" ? input.traceId : `trace-restore-${Date.now()}`,
        };
        const auditResult = await writeRestoreAudit(event, deps.auditStore);
        const envelope: RuntimeOpsEnvelope = {
          ok: restoreResult.ok && auditResult.ok,
          command: "restore",
          runtimeMode: "workspace_full_runtime",
          surfaceMode: "cli",
          generatedAt,
          data: {
            auditWritten: auditResult.warnings.length === 0,
            fromVersion: event.fromVersion,
            toVersion: event.toVersion,
            restoreTarget: event.restoreTarget,
            isPartialRestore: event.failedEntities.length > 0,
            failedEntities: event.failedEntities,
            completedEntities: event.completedEntities,
            restoreSnapshotStoreAvailable: !!deps.restoreSnapshotStore,
          },
          warnings: [...restoreResult.warnings, ...auditResult.warnings],
          sourceRefs: [
            "observability/services/restore-audit-service.ts",
            "storage/services/restore-snapshot-store.ts",
          ],
        };
        return envelope;
      }

      /**
       * [G7] runtime_secret_bootstrap — RuntimeSecretAnchorView pass-through.
       * Requires secretAnchorDeps in OpsRouterDeps; never returns key plaintext.
       */
      if (command === "runtime_secret_bootstrap") {
        const generatedAt = new Date().toISOString();
        if (!deps.secretAnchorDeps) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "runtime_secret_bootstrap",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "SECRET_ANCHOR_DEPS_UNAVAILABLE",
              message: "runtime_secret_bootstrap requires secretAnchorDeps in OpsRouterDeps",
              nextStep: "wire_secret_anchor_deps_into_ops_router",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
        try {
          const view = await viewSecretAnchor(deps.secretAnchorDeps);
          // Map to RuntimeSecretBootstrapView (design model §6.1)
          const data = {
            status:
              view.status === "verified" || view.status === "ok"
                ? ("ok" as const)
                : view.status === "missing"
                  ? ("runtime_secret_anchor_missing" as const)
                  : view.status === "wrong_key"
                    ? ("credential_recovery_required" as const)
                    : view.status === "decryption_failed"
                      ? ("runtime_secret_unavailable" as const)
                      : ("unknown" as const),
            keyHealth:
              view.status === "verified" || view.status === "ok"
                ? ("ok" as const)
                : view.status === "missing"
                  ? ("missing_key" as const)
                  : view.status === "wrong_key"
                    ? ("wrong_key" as const)
                    : ("unknown" as const),
            anchorLocation: view.keyPath,
            recoveryPrincipleRef: view.recoveryDocRef,
            plaintextKeyExposed: false as const,
            reasonCode: view.reasonCode,
            recoverySteps: view.recoverySteps,
          };
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "runtime_secret_bootstrap",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data,
            warnings: [],
            sourceRefs: ["observability/services/runtime-secret-anchor-view.ts"],
          };
          return envelope;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "runtime_secret_bootstrap",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: { code: "SECRET_ANCHOR_PROBE_FAILED", message: msg },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }
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
