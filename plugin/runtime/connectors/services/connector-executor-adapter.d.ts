/**
 * Adapter: assemble connector-system execution infrastructure into the
 * ConnectorExecutor interface consumed by EffectDispatcher.
 *
 * When credentials / base URLs are missing, returns an honest
 * terminal_failure instead of throwing so the heartbeat loop stays stable.
 */
import type { ConnectorExecutor } from "../base/contract.js";
export type { ConnectorExecutor } from "../base/contract.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { StateDatabase } from "../../storage/db/index.js";
export interface ConnectorExecutorAdapterOptions {
    stateDb: StateDatabase;
    observabilityDb: ObservabilityDatabase;
    workspaceRoot?: string;
}
export declare function createConnectorExecutorAdapter(options: ConnectorExecutorAdapterOptions): ConnectorExecutor;
