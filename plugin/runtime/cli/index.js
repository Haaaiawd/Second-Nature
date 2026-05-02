import { createObservabilityDatabase } from "../observability/db/index.js";
import { createStateAPI, createStateDatabase } from "../storage/index.js";
import path from "node:path";
import { createActionBridge } from "./action-bridge.js";
import { createCliCommands } from "./commands/index.js";
import { createOpsRouter } from "./ops/ops-router.js";
import { createCliReadModels } from "./read-models/index.js";
import { resolvePackagedRuntime } from "./runtime/runtime-artifact-boundary.js";
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
    const pluginRoot = path.join(process.cwd(), "plugin");
    const opsRouter = createOpsRouter({ runtimeAvailable: resolvePackagedRuntime(pluginRoot).ok });
    const commands = createCliCommands({
        readModels: runtime.readModels,
        actionBridge: runtime.actionBridge,
        opsRouter,
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
export { createOpsRouter } from "./ops/ops-router.js";
export { heartbeatCheck, } from "./ops/heartbeat-surface.js";
export * from "./host-capability/types.js";
export { classifyDeliveryCapability } from "./host-capability/classify-delivery.js";
export { probeHostCapability } from "./host-capability/probe-host-capability.js";
export { recordHostCapability } from "./host-capability/record-host-capability.js";
export { runHostSmoke } from "./host-smoke/run-host-smoke.js";
export { explainSurfaceSubject } from "./explain/explain-surface-subject.js";
