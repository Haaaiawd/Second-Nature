import { createObservabilityDatabase } from "../observability/db/index.js";
import { createStateAPI, createStateDatabase } from "../storage/index.js";
import { createActionBridge } from "./action-bridge.js";
import { createCliCommands } from "./commands/index.js";
import { createCliReadModels } from "./read-models/index.js";
export function createCliRuntimeDeps(overrides = {}) {
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
export function createCommandRouter(options = {}) {
    const runtime = createCliRuntimeDeps(options.deps);
    const commands = createCliCommands({
        readModels: runtime.readModels,
        actionBridge: runtime.actionBridge,
    });
    return {
        commands,
        resolve(name) {
            return commands.find((command) => command.name === name);
        },
    };
}
export function closeCliRuntimeDeps(deps) {
    deps.stateDb.close();
    deps.observabilityDb.close();
}
