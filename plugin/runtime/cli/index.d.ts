import { type ObservabilityDatabase } from "../observability/db/index.js";
import { type StateDatabase, type StateAPI } from "../storage/index.js";
import { type ActionBridge } from "./action-bridge.js";
import { type CliCommandDefinition } from "./commands/index.js";
import { type CliReadModels } from "./read-models/index.js";
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
export declare function createCliRuntimeDeps(overrides?: Partial<CliRuntimeDeps>): CliRuntimeDeps;
export declare function createCommandRouter(options?: CreateCommandRouterOptions): CommandRouter;
export declare function closeCliRuntimeDeps(deps: Pick<CliRuntimeDeps, "stateDb" | "observabilityDb">): void;
