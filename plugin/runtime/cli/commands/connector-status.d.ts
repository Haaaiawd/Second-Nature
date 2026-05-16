import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";
import type { ConnectorInventoryLedger } from "../../observability/connector-inventory-ledger.js";
export interface ConnectorStatusInput {
    includeHealth?: boolean;
    workspaceRoot?: string;
}
export interface ConnectorTestInput {
    platformId: string;
    dryRun?: boolean;
}
export declare function connectorStatus(registry: DynamicConnectorRegistry | undefined, ledger: ConnectorInventoryLedger | undefined, input?: ConnectorStatusInput): Promise<Record<string, unknown>>;
export declare function connectorTest(registry: DynamicConnectorRegistry | undefined, input: ConnectorTestInput): Promise<Record<string, unknown>>;
