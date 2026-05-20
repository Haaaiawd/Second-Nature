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
  createRuntimeDecisionRecorder,
  type RuntimeDecisionRecorder,
} from "../observability/services/runtime-decision-recorder.js";
import {
  createConnectorExecutorAdapter,
  type ConnectorExecutor,
} from "../connectors/services/connector-executor-adapter.js";
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
  /** T1.2.3 — DynamicConnectorRegistry for connector:status / connector:test commands. */
  registry: DynamicConnectorRegistryType;
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

  return {
    stateDb,
    observabilityDb,
    stateApi,
    readModels,
    actionBridge,
    runtimeRecorder,
    connectorExecutor,
    registry,
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
    registry: runtime.registry,
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
