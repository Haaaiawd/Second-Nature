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
import { resolvePackagedRuntime } from "./runtime/runtime-artifact-boundary.js";
import {
  createRuntimeDecisionRecorder,
  type RuntimeDecisionRecorder,
} from "../observability/services/runtime-decision-recorder.js";

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
}

export interface CreateCommandRouterOptions {
  deps?: Partial<CliRuntimeDeps>;
}

export function createCliRuntimeDeps(
  overrides: Partial<CliRuntimeDeps> = {},
): CliRuntimeDeps {
  const stateDb = overrides.stateDb ?? createStateDatabase();
  const observabilityDb =
    overrides.observabilityDb ?? createObservabilityDatabase();
  const stateApi = overrides.stateApi ?? createStateAPI(stateDb);
  const readModels =
    overrides.readModels ??
    createCliReadModels({
      stateDb,
      observabilityDb,
      workspaceRoot: process.cwd(),
    });
  const actionBridge = overrides.actionBridge ?? createActionBridge(stateApi);
  const runtimeRecorder =
    overrides.runtimeRecorder ?? createRuntimeDecisionRecorder(observabilityDb);

  return {
    stateDb,
    observabilityDb,
    stateApi,
    readModels,
    actionBridge,
    runtimeRecorder,
  };
}

export function createCommandRouter(
  options: CreateCommandRouterOptions = {},
): CommandRouter {
  const runtime = createCliRuntimeDeps(options.deps);
  const pluginRoot = path.join(process.cwd(), "plugin");
  const opsRouter = createOpsRouter({
    runtimeAvailable: resolvePackagedRuntime(pluginRoot).ok,
    readModels: runtime.readModels,
    runtimeRecorder: runtime.runtimeRecorder,
    state: runtime.stateDb,
    workspaceRoot: process.cwd(),
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
