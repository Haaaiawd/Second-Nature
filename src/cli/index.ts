import {
  createObservabilityDatabase,
  type ObservabilityDatabase,
} from "../observability/db/index.js";
import {
  createStateAPI,
  createStateDatabase,
  type StateDatabase,
  type StateAPI,
} from "../storage/index.js";
import path from "node:path";

import { createActionBridge, type ActionBridge } from "./action-bridge.js";
import {
  createCliCommands,
  type CliCommandDefinition,
} from "./commands/index.js";
import { createOpsRouter } from "./ops/ops-router.js";
import {
  createCliReadModels,
  type CliReadModels,
} from "./read-models/index.js";
import type { AppendOnlyAuditStore } from "../observability/audit/append-only-audit-store.js";
import { resolvePackagedRuntime } from "./runtime/runtime-artifact-boundary.js";
import {
  createRestoreSnapshotStore,
  type RestoreSnapshotStore,
} from "../storage/services/restore-snapshot-store.js";
import {
  createRuntimeDecisionRecorder,
  type RuntimeDecisionRecorder,
} from "../observability/services/runtime-decision-recorder.js";
import {
  createConnectorExecutorAdapter,
  type ConnectorExecutor,
} from "../connectors/services/connector-executor-adapter.js";
import { CapabilityContractRegistry, type ConnectorManifest } from "../connectors/base/manifest.js";
import { CapabilityContractRegistryV7, type IdempotencyClass } from "../connectors/base/manifest-v7.js";
import { moltbookManifest } from "../connectors/social-community/moltbook/manifest.js";
import { evomapManifest } from "../connectors/agent-network/evomap/manifest.js";
import { agentWorldManifest } from "../connectors/agent-network/agent-world/manifest.js";
import { instreetManifest } from "../connectors/social-community/instreet/manifest.js";
import {
  createAffordanceAssembler,
  type AffordanceAssembler,
} from "../core/second-nature/body/tool-affordance/affordance-assembler.js";
import {
  createHistoryDigestStore,
} from "../storage/services/history-digest-store.js";
import {
  probeCredentialHealth,
} from "../storage/services/credential-vault.js";
import type {
  NarrativeTimelineDeps,
  NarrativeTimelineRow,
  NarrativeSnapshotRow,
} from "../observability/services/narrative-timeline-query-service.js";
import type {
  SecretAnchorDeps,
  SampleDecryptResult,
} from "../observability/services/runtime-secret-anchor-view.js";
import {
  DynamicConnectorRegistry,
  createRegistrySnapshotStore,
  type DynamicConnectorRegistry as DynamicConnectorRegistryType,
} from "../connectors/registry/index.js";
import type { ConnectorManifestV6 } from "../connectors/manifest/manifest-schema.js";

/** Built-in connector manifests for DynamicConnectorRegistry. */
const BUILT_IN_CONNECTOR_MANIFESTS: ConnectorManifestV6[] = [
  {
    schemaVersion: "sn.connector.v1",
    platformId: "moltbook",
    displayName: "Moltbook",
    family: "social_community",
    capabilities: [
      { id: "feed.read" },
      { id: "post.publish" },
      { id: "comment.reply" },
    ],
    runner: { kind: "declarative_http" },
    credentials: [{ type: "api_key", required: true }],
    sourceRefPolicy: { minSourceRefs: 1 },
  },
  {
    schemaVersion: "sn.connector.v1",
    platformId: "evomap",
    displayName: "EvoMap",
    family: "agent_network",
    capabilities: [
      { id: "agent.register" },
      { id: "work.discover" },
    ],
    runner: { kind: "declarative_http" },
    credentials: [{ type: "api_key", required: true }],
    sourceRefPolicy: { minSourceRefs: 1 },
  },
  {
    schemaVersion: "sn.connector.v1",
    platformId: "agent-world",
    displayName: "Agent World",
    family: "agent_network",
    capabilities: [
      { id: "feed.read" },
      { id: "work.discover" },
      { id: "task.claim" },
    ],
    runner: { kind: "declarative_http" },
    credentials: [{ type: "api_key", required: true }],
    sourceRefPolicy: { minSourceRefs: 1 },
  },
];

const BUILT_IN_CAPABILITY_MANIFESTS: ConnectorManifest[] = [
  moltbookManifest,
  evomapManifest,
  agentWorldManifest,
  instreetManifest,
];

function idempotencyClassForCapability(capabilityId: string): IdempotencyClass {
  return capabilityId.includes("read") ||
    capabilityId.includes("discover") ||
    capabilityId.includes("list") ||
    capabilityId.includes("heartbeat")
    ? "read_only"
    : "idempotent_write";
}

function createCapabilityRegistry(): CapabilityContractRegistry {
  const registry = new CapabilityContractRegistry();
  for (const manifest of BUILT_IN_CAPABILITY_MANIFESTS) {
    registry.register(manifest);
  }
  return registry;
}

function createAffordanceRegistry(
  registry: DynamicConnectorRegistryType,
  workspaceRoot: string,
): CapabilityContractRegistryV7 {
  registry.reloadConnectors(workspaceRoot);
  const v7 = new CapabilityContractRegistryV7();
  for (const entry of registry.listConnectors()) {
    v7.register({
      platformId: entry.platformId,
      capabilities: entry.capabilities.map((capabilityId) => ({
        capabilityId,
        intent: capabilityId,
        probeConfig: {
          safeEndpoint: `connector://${entry.platformId}/${capabilityId}`,
          idempotencyClass: idempotencyClassForCapability(capabilityId),
        },
      })),
      channelPriority: ["api_rest"],
      credentialTypes: ["api_key"],
      sourceRefPolicy: { minSourceRefs: 1 },
    });
  }
  return v7;
}

function createWorkspaceAffordanceAssembler(
  registry: DynamicConnectorRegistryType,
  workspaceRoot: string,
): AffordanceAssembler {
  return createAffordanceAssembler({
    registry: createAffordanceRegistry(registry, workspaceRoot),
    probeReader: {
      getLatestProbeResult() {
        return undefined;
      },
    },
    credentialRequired: () => false,
  });
}

function stringifyDeltaField(
  delta: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = delta[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function createNarrativeTimelineDeps(
  stateDb: StateDatabase,
): NarrativeTimelineDeps {
  const historyStore = createHistoryDigestStore(stateDb);
  return {
    stateMemoryPort: {
      async listNarrativeTimeline(from, to, opts) {
        const rows = await historyStore.listNarrativeTimeline({
          limit: Math.max(opts?.limit ?? 100, 100),
        });
        return rows
          .filter((row) => row.createdAt >= from && row.createdAt <= to)
          .filter((row) =>
            opts?.afterTimestamp ? row.createdAt > opts.afterTimestamp : true,
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(0, opts?.limit ?? rows.length)
          .map<NarrativeTimelineRow>((row) => ({
            version: row.timelineId,
            createdAt: row.createdAt,
            triggerKind:
              row.entryType === "restore.applied" ||
              row.entryType === "goal.transition" ||
              row.entryType === "dream.projection" ||
              row.entryType === "owner.override"
                ? row.entryType
                : "heartbeat.decision",
            sourceRefs: asStringArray(row.delta.sourceRefs),
            reasonCode: stringifyDeltaField(row.delta, "reasonCode"),
            summaryText:
              stringifyDeltaField(row.delta, "summaryText") ??
              `${row.entryType}:${row.subjectId}`,
          }));
      },
      async getNarrativeSnapshot(version) {
        const rows = await historyStore.listNarrativeTimeline({ limit: 500 });
        const row = rows.find(
          (candidate) =>
            candidate.timelineId === version || candidate.subjectId === version,
        );
        if (!row) return null;
        const delta = row.delta;
        return {
          version,
          focus: delta.focus,
          progress: delta.progress,
          nextIntent: delta.nextIntent,
          toneSignal: delta.toneSignal,
          acceptedGoalId: delta.acceptedGoalId,
          sourceRefs: asStringArray(delta.sourceRefs),
          lastChangeReasonCode: stringifyDeltaField(delta, "reasonCode"),
        } satisfies NarrativeSnapshotRow;
      },
    },
  };
}

function createSecretAnchorDeps(stateDb: StateDatabase): SecretAnchorDeps {
  return {
    runtimeOpsPort: {
      getEncryptionKeyPath: () => "SECOND_NATURE_ENCRYPTION_KEY",
      checkKeyPathExists: async () => {
        const key = process.env.SECOND_NATURE_ENCRYPTION_KEY?.trim();
        return Boolean(key && key.length >= 32);
      },
    },
    credentialPort: {
      verifySampleDecrypt: async (): Promise<SampleDecryptResult> => {
        const result = stateDb.sqlite.exec(
          `SELECT platform_id, encrypted_value
           FROM credential_records
           WHERE encrypted_value IS NOT NULL AND encrypted_value != ''
           LIMIT 3`,
        );
        if (result.length === 0 || result[0]!.values.length === 0) {
          return { status: "ok", checkedIds: [] };
        }
        const checkedIds: string[] = [];
        for (const row of result[0]!.values) {
          const platformId = String(row[0] ?? "unknown");
          const encryptedValue = typeof row[1] === "string" ? row[1] : "";
          checkedIds.push(platformId);
          const probe = probeCredentialHealth(platformId, encryptedValue, undefined);
          if (probe.keyHealth === "wrong_key") {
            return { status: "wrong_key", checkedIds };
          }
          if (probe.keyHealth !== "ok") {
            return { status: "error", checkedIds };
          }
        }
        return { status: "ok", checkedIds };
      },
    },
  };
}

export interface CommandRouter {
  commands: CliCommandDefinition[];
  resolve(name: string): CliCommandDefinition | undefined;
}

export interface CommandRouterDeps {
  commands: CliCommandDefinition[];
}

export interface CliRuntimeDeps {
  stateDb: StateDatabase;
  observabilityDb: ObservabilityDatabase;
  stateApi: StateAPI;
  readModels: CliReadModels;
  actionBridge: ActionBridge;
  /** T1.2.3 — write back full-runtime heartbeat cycles into observability so `loadStatus` exits unknown. */
  runtimeRecorder: RuntimeDecisionRecorder;
  /** Connector-system executor used by full-runtime heartbeat connector_action intents. */
  connectorExecutor: ConnectorExecutor;
  /** Capability registry used by heartbeat planner to avoid platform/capability mismatches. */
  capabilityRegistry: CapabilityContractRegistry;
  /** T1.2.3 — DynamicConnectorRegistry for connector:status / connector:test commands. */
  registry: DynamicConnectorRegistryType;
  /** T-ROS.C.1 — body-tool affordance map port. */
  affordanceAssembler: AffordanceAssembler;
  /** T-ROS.C.1 — narrative timeline query deps. */
  narrativeTimelineDeps: NarrativeTimelineDeps;
  /** T-ROS.C.1 — runtime secret anchor health deps. */
  secretAnchorDeps: SecretAnchorDeps;
  /** T-ROS.C.1 — bounded restore port used by runtime restore command. */
  restoreSnapshotStore: RestoreSnapshotStore;
}

export interface CreateCommandRouterOptions {
  deps?: Partial<CliRuntimeDeps>;
}

export interface CreateCliRuntimeDepsOptions extends Partial<CliRuntimeDeps> {
  /** T1.2.7 — pass an explicit audit store so `loadAuditSummary()` reflects test-injected events. */
  livedExperienceAuditStore?: AppendOnlyAuditStore;
  workspaceRoot?: string;
}

export function createCliRuntimeDeps(
  overrides: CreateCliRuntimeDepsOptions = {},
): CliRuntimeDeps {
  const workspaceRoot = overrides.workspaceRoot ?? process.cwd();
  const stateDb = overrides.stateDb ?? createStateDatabase();
  const observabilityDb =
    overrides.observabilityDb ?? createObservabilityDatabase();
  const stateApi = overrides.stateApi ?? createStateAPI(stateDb);
  const readModels =
    overrides.readModels ??
    createCliReadModels({
      stateDb,
      observabilityDb,
      workspaceRoot,
      livedExperienceAuditStore: overrides.livedExperienceAuditStore,
    });
  const actionBridge = overrides.actionBridge ?? createActionBridge(stateApi);
  const runtimeRecorder =
    overrides.runtimeRecorder ?? createRuntimeDecisionRecorder(observabilityDb);
  const connectorExecutor =
    overrides.connectorExecutor ??
    createConnectorExecutorAdapter({
      stateDb,
      observabilityDb,
      workspaceRoot,
    });
  const registry =
    overrides.registry ??
    new DynamicConnectorRegistry({
      builtInManifests: BUILT_IN_CONNECTOR_MANIFESTS,
      snapshotStore: createRegistrySnapshotStore(),
    });
  const capabilityRegistry =
    overrides.capabilityRegistry ?? createCapabilityRegistry();
  const affordanceAssembler =
    overrides.affordanceAssembler ??
    createWorkspaceAffordanceAssembler(registry, workspaceRoot);
  const narrativeTimelineDeps =
    overrides.narrativeTimelineDeps ?? createNarrativeTimelineDeps(stateDb);
  const secretAnchorDeps =
    overrides.secretAnchorDeps ?? createSecretAnchorDeps(stateDb);
  const restoreSnapshotStore =
    overrides.restoreSnapshotStore ?? createRestoreSnapshotStore(stateDb);

  return {
    stateDb,
    observabilityDb,
    stateApi,
    readModels,
    actionBridge,
    runtimeRecorder,
    connectorExecutor,
    capabilityRegistry,
    registry,
    affordanceAssembler,
    narrativeTimelineDeps,
    secretAnchorDeps,
    restoreSnapshotStore,
  };
}

export function createCommandRouter(
  options: CreateCommandRouterOptions = {},
): CommandRouter {
  const workspaceRoot = process.cwd();
  const runtime = createCliRuntimeDeps(options.deps);
  const pluginRoot = path.join(process.cwd(), "plugin");
  const opsRouter = createOpsRouter({
    runtimeAvailable: resolvePackagedRuntime(pluginRoot).ok,
    readModels: runtime.readModels,
    runtimeRecorder: runtime.runtimeRecorder,
    state: runtime.stateDb,
    workspaceRoot,
    observabilityDb: runtime.observabilityDb,
    connectorExecutor: runtime.connectorExecutor,
    connectorRegistry: runtime.capabilityRegistry,
    registry: runtime.registry,
    toolAffordancePort: runtime.affordanceAssembler,
    narrativeTimelineDeps: runtime.narrativeTimelineDeps,
    secretAnchorDeps: runtime.secretAnchorDeps,
    restoreSnapshotStore: runtime.restoreSnapshotStore,
  });
  const commands = createCliCommands({
    readModels: runtime.readModels,
    actionBridge: runtime.actionBridge,
    opsRouter,
  });

  return {
    commands,
    resolve(name: string) {
      return commands.find((command) => command.name === name);
    },
  };
}

export function closeCliRuntimeDeps(
  deps: Pick<CliRuntimeDeps, "stateDb" | "observabilityDb">,
): void {
  deps.stateDb.close();
  deps.observabilityDb.close();
}

export {
  createOpsRouter,
  type OpsRouter,
  type OpsRouterDeps,
} from "./ops/ops-router.js";
export {
  heartbeatCheck,
  type HeartbeatSurfaceResult,
  type HeartbeatSurfaceStatus,
  type HeartbeatCheckInput,
} from "./ops/heartbeat-surface.js";
export * from "./host-capability/types.js";
export {
  classifyDeliveryCapability,
  type ClassifyDeliveryCapabilityInput,
} from "./host-capability/classify-delivery.js";
export { probeHostCapability } from "./host-capability/probe-host-capability.js";
export { recordHostCapability } from "./host-capability/record-host-capability.js";
export { runHostSmoke } from "./host-smoke/run-host-smoke.js";
export type {
  HostSmokePlan,
  HostSmokeReport,
  HostSmokeCase,
  HostSmokeCaseResult,
} from "./host-smoke/types.js";
export { explainSurfaceSubject } from "./explain/explain-surface-subject.js";
export {
  showOperatorFallback,
  OperatorFallbackNotFoundError,
} from "./ops/show-operator-fallback.js";
