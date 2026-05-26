/**
 * Shared ops command dispatch for CLI + tool surfaces (T1.1.3, T1.2.2).
 *
 * v7 additions (T-ROS.C.1): self_health, tool_affordance, connector_test --wet,
 * heartbeat_digest, narrative:diff, timeline, restore, runtime_secret_bootstrap.
 * All commands return RuntimeOpsEnvelope.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
  NarrativeVersionNotFoundError,
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
import { createHistoryDigestStore } from "../../storage/services/history-digest-store.js";
// T-ROS.C.3: ManualRunDispatcher and its deps
import {
  createManualRunDispatcher,
  type ManualRunDispatcher,
} from "./manual-run-dispatcher.js";
import { createExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import {
  createCapabilityProbeResultStore,
  createToolExperienceStore,
} from "../../storage/services/tool-experience-store.js";
import { createWetProbeRunner } from "../../connectors/base/wet-probe-runner.js";
import { CapabilityContractRegistryV7 } from "../../connectors/base/manifest-v7.js";
import type { CapabilityContractRegistry } from "../../connectors/base/manifest.js";
import type { AffordanceAssembler } from "../../core/second-nature/body/tool-affordance/affordance-assembler.js";
import type {
  AffordanceStatus,
  RestorableEntityKind,
} from "../../shared/types/v7-entities.js";

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

const SNAPSHOT_TABLE_BY_KIND: Record<RestorableEntityKind, string> = {
  identity_profile: "identity_profile",
  agent_goal: "agent_goal",
  tool_experience: "tool_experience",
  daily_diary: "daily_diary_index",
  dream_output: "dream_output_index",
  narrative_timeline: "narrative_timeline",
};

const DEFAULT_SNAPSHOT_KINDS: readonly RestorableEntityKind[] = [
  "identity_profile",
  "agent_goal",
  "tool_experience",
  "daily_diary",
  "dream_output",
  "narrative_timeline",
];

function coerceRestorableKinds(value: unknown): RestorableEntityKind[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const valid = new Set(DEFAULT_SNAPSHOT_KINDS);
  return value.filter(
    (item): item is RestorableEntityKind =>
      typeof item === "string" && valid.has(item as RestorableEntityKind),
  );
}

function tableExists(state: StateDatabase, table: string): boolean {
  const result = state.sqlite.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [table],
  );
  return result.length > 0 && result[0]!.values.length > 0;
}

function readRowsFromTable(
  state: StateDatabase,
  table: string,
): Record<string, unknown>[] {
  const result = state.sqlite.exec(`SELECT * FROM ${table}`);
  if (result.length === 0 || result[0]!.values.length === 0) return [];
  const columns = result[0]!.columns;
  return result[0]!.values.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      out[column] = row[index];
    });
    return out;
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function textInput(
  input: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = input?.[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildSnapshotNarrativeDelta(
  input: Record<string, unknown> | undefined,
  snapshotId: string,
  rowCounts: Record<string, number>,
): Record<string, unknown> {
  const explicit =
    input?.narrativeSnapshot &&
    typeof input.narrativeSnapshot === "object" &&
    !Array.isArray(input.narrativeSnapshot)
      ? (input.narrativeSnapshot as Record<string, unknown>)
      : {};
  const from = (key: string) => input?.[key] ?? explicit[key];
  const sourceRefs = stringArray(from("sourceRefs"));
  return {
    focus: from("focus") ?? "workspace_state",
    progress:
      from("progress") ??
      `snapshot_captured:${Object.entries(rowCounts)
        .map(([kind, count]) => `${kind}=${count}`)
        .join(",")}`,
    nextIntent: from("nextIntent") ?? "restore_ready",
    toneSignal: from("toneSignal") ?? "system_maintenance",
    acceptedGoalId: from("acceptedGoalId") ?? undefined,
    sourceRefs:
      sourceRefs.length > 0
        ? sourceRefs
        : [`restore_snapshot:${snapshotId}`, "runtime_ops:snapshot_capture"],
    reasonCode: from("reasonCode") ?? "snapshot_captured",
    summaryText: from("summaryText") ?? `Captured restore snapshot ${snapshotId}`,
  };
}

function hashNarrativeSnapshot(input: {
  previousHash: string;
  snapshotId: string;
  delta: Record<string, unknown>;
  createdAt: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        previousHash: input.previousHash,
        snapshotId: input.snapshotId,
        delta: input.delta,
        createdAt: input.createdAt,
      }),
    )
    .digest("hex");
}

function resolveManifestPath(
  manifestPath: string,
  workspaceRoot?: string,
): string {
  if (path.isAbsolute(manifestPath)) return manifestPath;
  return path.join(workspaceRoot ?? process.cwd(), manifestPath);
}

function registerConnectorForWetProbe(input: {
  registryV7: CapabilityContractRegistryV7;
  entry: {
    platformId: string;
    capabilities: string[];
    manifestPath?: string;
  };
  workspaceRoot?: string;
  selectedCapabilityId: string;
  safeEndpoint?: string;
}): void {
  if (input.entry.manifestPath) {
    try {
      const manifestText = fs.readFileSync(
        resolveManifestPath(input.entry.manifestPath, input.workspaceRoot),
        "utf-8",
      );
      const parsed = JSON.parse(manifestText) as Record<string, unknown>;
      const registered = input.registryV7.register(parsed);
      if (registered.ok && input.registryV7.hasCapability(input.entry.platformId, input.selectedCapabilityId)) {
        return;
      }
    } catch {
      // Non-v7 or YAML workspace manifests are projected below.
    }
  }

  input.registryV7.register({
    platformId: input.entry.platformId,
    capabilities: input.entry.capabilities.map((capabilityId) => ({
      capabilityId,
      intent: capabilityId,
      probeConfig:
        capabilityId === input.selectedCapabilityId && input.safeEndpoint
          ? {
              safeEndpoint: input.safeEndpoint,
              idempotencyClass: "read_only",
            }
          : undefined,
    })),
    channelPriority: ["runtime_ops"],
    credentialTypes: ["runtime_ops_probe"],
  });
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
  /** Capability registry used by heartbeat planner to avoid platform/capability mismatches. */
  connectorRegistry?: CapabilityContractRegistry;
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
  /** Port for tool_affordance command. */
  toolAffordancePort?: AffordanceAssembler;
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

async function captureRuntimeSnapshot(
  deps: OpsRouterDeps,
  input: Record<string, unknown> | undefined,
): Promise<RuntimeOpsEnvelope> {
  const generatedAt = new Date().toISOString();
  if (!deps.state || !deps.restoreSnapshotStore) {
    return {
      ok: false,
      command: "snapshot:capture",
      runtimeMode: "unavailable",
      surfaceMode: "cli",
      generatedAt,
      error: {
        code: "SNAPSHOT_CAPTURE_DEPS_UNAVAILABLE",
        message: "snapshot:capture requires state DB and RestoreSnapshotStore in OpsRouterDeps",
        nextStep: "wire_state_and_restore_snapshot_store_into_ops_router",
      },
      warnings: [],
      sourceRefs: [],
    };
  }

  const snapshotId =
    textInput(input, "snapshotId") ??
    `snapshot:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const requestedKinds =
    coerceRestorableKinds(input?.entityWhitelist) ?? [...DEFAULT_SNAPSHOT_KINDS];
  const rowCounts: Record<string, number> = {};
  const warnings: string[] = [];

  for (const kind of requestedKinds) {
    const table = SNAPSHOT_TABLE_BY_KIND[kind];
    if (!tableExists(deps.state, table)) {
      rowCounts[kind] = 0;
      warnings.push(`table_missing:${kind}:${table}`);
      continue;
    }
    rowCounts[kind] = readRowsFromTable(deps.state, table).length;
  }

  const historyStore = createHistoryDigestStore(deps.state);
  const previousHash =
    (await historyStore.listNarrativeTimeline({ limit: 1 }))[0]?.currentHash ?? "";
  const delta = buildSnapshotNarrativeDelta(input, snapshotId, rowCounts);
  const currentHash = hashNarrativeSnapshot({
    previousHash,
    snapshotId,
    delta,
    createdAt: generatedAt,
  });
  await historyStore.appendNarrativeTimeline({
    timelineId: snapshotId,
    entryType: "owner.override",
    subjectId: textInput(input, "subjectId") ?? snapshotId,
    delta,
    previousHash,
    currentHash,
    createdAt: generatedAt,
  });

  const payload: Record<string, unknown> = {};
  const capturedKinds: RestorableEntityKind[] = [];
  for (const kind of requestedKinds) {
    const table = SNAPSHOT_TABLE_BY_KIND[kind];
    if (!tableExists(deps.state, table)) continue;
    const rows = readRowsFromTable(deps.state, table);
    rowCounts[kind] = rows.length;
    if (rows.length > 0) {
      payload[kind] = rows;
      capturedKinds.push(kind);
    }
  }

  const snapshot = await deps.restoreSnapshotStore.captureSnapshot({
    snapshotId,
    entityWhitelist: requestedKinds,
    payload,
    capturedAt: generatedAt,
  });

  return {
    ok: true,
    command: "snapshot:capture",
    runtimeMode: "workspace_full_runtime",
    surfaceMode: "cli",
    generatedAt,
    data: {
      snapshotId: snapshot.snapshotId,
      capturedAt: snapshot.capturedAt,
      entityWhitelist: snapshot.entityWhitelist,
      capturedKinds,
      rowCounts,
      narrativeVersion: snapshotId,
    },
    warnings,
    sourceRefs: [
      "storage/services/restore-snapshot-store.ts",
      "storage/services/history-digest-store.ts",
    ],
  };
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
        connectorRegistry:
          (input as Partial<HeartbeatCheckInput> | undefined)
            ?.connectorRegistry ?? deps.connectorRegistry,
      }),
    async dispatch(command, input) {
      if (command === "heartbeat_check") {
        const runtimeAvailable =
          typeof input?.runtimeAvailable === "boolean"
            ? input.runtimeAvailable
            : deps.runtimeAvailable;

        // v7 T-V7C.C.2: assemble affordance map and experience writer for breaker-aware heartbeat.
        let affordanceMap: import("../../shared/types/v7-entities.js").AffordanceMap | undefined;
        if (deps.toolAffordancePort) {
          try {
            affordanceMap = await deps.toolAffordancePort.assembleAffordanceMap({});
          } catch {
            // degrade gracefully; guard-layer will skip breaker check without affordanceMap
          }
        }
        let experienceWriter: import("../../core/second-nature/body/tool-experience/experience-writer.js").ExperienceWriter | undefined;
        if (deps.state) {
          experienceWriter = createExperienceWriter(createToolExperienceStore(deps.state));
        }

        const result = await heartbeatCheck({
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
          connectorRegistry:
            (input as Partial<HeartbeatCheckInput> | undefined)
              ?.connectorRegistry ?? deps.connectorRegistry,
          affordanceMap,
          experienceWriter,
        });
        if (
          result.ok &&
          result.surfaceMode === "workspace_full_runtime" &&
          !coerceProbeOnlyFlag(input) &&
          deps.state &&
          deps.restoreSnapshotStore
        ) {
          try {
            const capture = await captureRuntimeSnapshot(deps, {
              snapshotId: `heartbeat:${result.decisionId ?? "cycle"}:${Date.now()}`,
              subjectId: result.decisionId ?? "heartbeat_check",
              reasonCode: "heartbeat_check",
              summaryText: `Heartbeat ${result.status} captured bounded restore snapshot`,
              focus: result.status,
              progress: result.reasons.join(",") || "heartbeat_completed",
              nextIntent: "continue_runtime_loop",
              sourceRefs: result.decisionId
                ? [`heartbeat:${result.decisionId}`]
                : ["heartbeat:runtime"],
            });
            if (capture.ok) {
              result.reasons = [...result.reasons, "restore_snapshot_captured"];
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.reasons = [...result.reasons, `restore_snapshot_capture_failed:${msg}`];
          }
        }
        return result;
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
        // v7 T-V7C.C.1: dryRun=false is the canonical wet probe switch.
        const isWet =
          input?.wet === true ||
          input?.wet === "true" ||
          input?.dryRun === false ||
          input?.dryRun === "false";
        const result = await connectorTest(deps.registry, {
          platformId:
            typeof input?.platformId === "string" ? input.platformId : "",
          dryRun: isWet ? false : (input?.dryRun === false ? false : true),
          workspaceRoot:
            typeof input?.workspaceRoot === "string"
              ? input.workspaceRoot
              : deps.workspaceRoot,
        });
        if (!isWet || !result.ok) {
          return result;
        }

        const data =
          result.data && typeof result.data === "object"
            ? (result.data as Record<string, unknown>)
            : {};
        const capabilities = Array.isArray(data.capabilities)
          ? data.capabilities.filter((item): item is string => typeof item === "string")
          : [];
        const capabilityId =
          textInput(input, "capabilityId") ?? capabilities[0] ?? "";
        if (!capabilityId) {
          return {
            ok: false,
            command: "connector_test" as const,
            error: {
              code: "MISSING_CAPABILITY_ID",
              message: "wet connector_test requires capabilityId or at least one connector capability",
              requiredUserInput: ["capabilityId"],
              nextStep: "reinvoke_with_capability_id",
            },
          };
        }

        const platformId = String(data.platformId ?? input?.platformId ?? "");
        const registryEntry = deps.registry?.describeConnector(platformId);
        if (!registryEntry) {
          return result;
        }

        const registryV7 = new CapabilityContractRegistryV7();
        registerConnectorForWetProbe({
          registryV7,
          entry: {
            platformId: registryEntry.platformId,
            capabilities: registryEntry.capabilities,
            manifestPath: registryEntry.manifestPath,
          },
          workspaceRoot:
            typeof input?.workspaceRoot === "string"
              ? input.workspaceRoot
              : deps.workspaceRoot,
          selectedCapabilityId: capabilityId,
          safeEndpoint: textInput(input, "safeEndpoint"),
        });

        const wetResult = await createWetProbeRunner().runWetProbe(
          platformId,
          capabilityId,
          registryV7,
        );
        const warnings: string[] = [];
        let persistedProbeResult = false;
        if (deps.state) {
          await createCapabilityProbeResultStore(deps.state).appendProbeResult(
            wetResult.probeResult,
          );
          persistedProbeResult = true;
        } else {
          warnings.push("state_db_unavailable:capability_probe_result_not_persisted");
        }
        return {
          ok: wetResult.probeResult.actualStatus !== "unavailable",
          command: "connector_test" as const,
          data: {
            ...data,
            dryRun: false,
            capabilityId,
            actualStatus: wetResult.probeResult.actualStatus,
            httpStatus: wetResult.probeResult.httpStatus ?? wetResult.httpStatus,
            probeResultId: wetResult.probeResult.probeResultId,
            probeConfigRef: wetResult.probeResult.probeConfigRef,
            sampleResponseRef: wetResult.probeResult.sampleResponseRef,
            persistedProbeResult,
            triggerSource: "manual_run",
            affectsHeartbeatCadence: false,
            note: "wet probe mode: executed safe probe endpoint and persisted capability_probe_result when state DB is available",
          },
          warnings,
        };
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
        if (deps.toolAffordancePort) {
          const allStatuses: AffordanceStatus[] = [
            "safe",
            "exploratory",
            "needs_auth",
            "painful",
            "unavailable",
          ];
          const platformIds = Array.isArray(input?.platformIds)
            ? input.platformIds.filter((item): item is string => typeof item === "string")
            : typeof input?.platformId === "string"
              ? [input.platformId]
              : undefined;
          const data = await deps.toolAffordancePort.assembleAffordanceMap({
            platformIds,
            allowedStatuses: allStatuses,
            goalKind:
              typeof input?.goalKind === "string" ? input.goalKind : undefined,
          });
          const envelope: RuntimeOpsEnvelope = {
            ok: true,
            command: "tool_affordance",
            runtimeMode: "workspace_full_runtime",
            surfaceMode: "cli",
            generatedAt,
            data,
            warnings: [],
            sourceRefs: [
              "core/second-nature/body/tool-affordance/affordance-assembler.ts",
            ],
          };
          return envelope;
        }
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
       * [G6] snapshot:capture — production capture path for RestoreSnapshot +
       * NarrativeTimeline. This gives restore and narrative:diff real state to consume.
       */
      if (command === "snapshot:capture") {
        return captureRuntimeSnapshot(deps, input);
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
          if (err instanceof NarrativeVersionNotFoundError) {
            const envelope: RuntimeOpsEnvelope = {
              ok: false,
              command: "narrative:diff",
              runtimeMode: "workspace_full_runtime",
              surfaceMode: "cli",
              generatedAt,
              error: {
                code: "NARRATIVE_VERSION_NOT_FOUND",
                message: err.message,
                nextStep: "verify_version_exists_in_timeline",
              },
              warnings: [],
              sourceRefs: [],
            };
            return envelope;
          }
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

      // ─── T-V7C.C.4R: guidance_payload ──────────────────────────────────────
      // Returns the assembled impulse + atmosphere for a given scene context.
      // Useful for Claw to inspect what guidance content would be injected before
      // a real heartbeat cycle, and to verify platform-specific impulse overrides.
      if (command === "guidance_payload") {
        const generatedAt = new Date().toISOString();
        const { assembleImpulseSync } = await import("../../guidance/impulse-assembler.js");
        const { getBaselineAtmosphereTemplate } = await import("../../guidance/template-registry.js");

        const sceneType = (input?.sceneType as string | undefined) ?? "social";
        const capabilityIntent = typeof input?.capabilityIntent === "string"
          ? input.capabilityIntent
          : undefined;
        const platformId = typeof input?.platformId === "string"
          ? input.platformId
          : undefined;

        const validSceneTypes = ["social", "reply", "outreach", "quiet", "explain", "user_reply"];
        if (!validSceneTypes.includes(sceneType)) {
          const envelope: RuntimeOpsEnvelope = {
            ok: false,
            command: "guidance_payload",
            runtimeMode: "unavailable",
            surfaceMode: "cli",
            generatedAt,
            error: {
              code: "INVALID_SCENE_TYPE",
              message: `sceneType must be one of: ${validSceneTypes.join(", ")}`,
              nextStep: "reinvoke_with_valid_scene_type",
            },
            warnings: [],
            sourceRefs: [],
          };
          return envelope;
        }

        const impulseResult = assembleImpulseSync({
          sceneType: sceneType as import("../../guidance/types.js").GuidanceSceneType,
          capabilityIntent,
          platformId,
        });

        const atmosphere = getBaselineAtmosphereTemplate();

        const envelope: RuntimeOpsEnvelope = {
          ok: true,
          command: "guidance_payload",
          runtimeMode: deps.runtimeAvailable ? "workspace_full_runtime" : "host_safe_carrier",
          surfaceMode: "cli",
          generatedAt,
          data: {
            sceneType,
            capabilityIntent: capabilityIntent ?? null,
            platformId: platformId ?? null,
            capabilityClass: impulseResult.capabilityClass,
            impulseSource: impulseResult.source,
            impulseText: impulseResult.impulse?.text ?? null,
            impulseReviewStatus: impulseResult.impulse?.reviewStatus ?? null,
            atmosphereText: atmosphere.text,
            atmosphereReviewStatus: atmosphere.reviewStatus,
          },
          warnings: impulseResult.source === "none"
            ? ["no_impulse_available_for_this_scene_and_capability"]
            : [],
          sourceRefs: [
            "guidance/capability-class.ts",
            "guidance/impulse-assembler.ts",
            "guidance/template-registry.ts",
          ],
        };
        return envelope;
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
