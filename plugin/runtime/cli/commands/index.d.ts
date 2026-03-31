import type { ActionBridge } from "../action-bridge.js";
import type { CliReadModels } from "../read-models/index.js";
export interface CliCommandDefinition {
    name: string;
    description: string;
    execute(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
export interface CliCommandDeps {
    readModels: CliReadModels;
    actionBridge: ActionBridge;
}
export declare function createCliCommands(deps: CliCommandDeps): CliCommandDefinition[];
