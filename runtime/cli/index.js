import { createObservabilityDatabase } from "../observability/db/index.js";
import { createStateAPI, createStateDatabase } from "../storage/index.js";
import { createActionBridge } from "./action-bridge.js";
import { createCliCommands } from "./commands/index.js";
import { createCliReadModels } from "./read-models/index.js";
export async function createCliRuntimeDeps(overrides = {}) {
    const stateDb = overrides.stateDb ?? await createStateDatabase();
    const observabilityDb = overrides.observabilityDb ?? await createObservabilityDatabase();
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
export async function createCommandRouter(options = {}) {
    const runtime = await createCliRuntimeDeps(options.deps);
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
