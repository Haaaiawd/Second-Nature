import type { ActionBridge } from "../action-bridge.js";
import type { OpsRouter } from "../ops/ops-router.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { CliReadModels } from "../read-models/index.js";
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
export declare function createCliCommands(deps: CliCommandDeps): CliCommandDefinition[];
