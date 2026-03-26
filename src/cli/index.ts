import { createObservabilityDatabase, type ObservabilityDatabase } from "../observability/db/index.js";
import { createStateAPI, createStateDatabase, type StateDatabase, type StateAPI } from "../storage/index.js";
import { createActionBridge, type ActionBridge } from "./action-bridge.js";
import { createCliCommands, type CliCommandDefinition } from "./commands/index.js";
import { createCliReadModels, type CliReadModels } from "./read-models/index.js";

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
}

export interface CreateCommandRouterOptions {
  deps?: Partial<CliRuntimeDeps>;
}

export function createCliRuntimeDeps(overrides: Partial<CliRuntimeDeps> = {}): CliRuntimeDeps {
  const stateDb = overrides.stateDb ?? createStateDatabase();
  const observabilityDb = overrides.observabilityDb ?? createObservabilityDatabase();
  const stateApi = overrides.stateApi ?? createStateAPI(stateDb);
  const readModels = overrides.readModels ?? createCliReadModels({ stateDb, observabilityDb });
  const actionBridge = overrides.actionBridge ?? createActionBridge(stateApi);

  return {
    stateDb,
    observabilityDb,
    stateApi,
    readModels,
    actionBridge,
  };
}

export function createCommandRouter(options: CreateCommandRouterOptions = {}): CommandRouter {
  const runtime = createCliRuntimeDeps(options.deps);
  const commands = createCliCommands({
    readModels: runtime.readModels,
    actionBridge: runtime.actionBridge,
  });

  return {
    commands,
    resolve(name: string) {
      return commands.find((command) => command.name === name);
    },
  };
}

export function closeCliRuntimeDeps(deps: Pick<CliRuntimeDeps, "stateDb" | "observabilityDb">): void {
  deps.stateDb.close();
  deps.observabilityDb.close();
}
