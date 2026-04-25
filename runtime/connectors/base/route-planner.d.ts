import { type CapabilityIntent, type ConnectorRequest, type ExecutionPlan, type RouteContextPort } from "./contract.js";
import type { CapabilityContractRegistry } from "./manifest.js";
import { ChannelHealthStore } from "./channel-health.js";
export declare class ConnectorRoutePlanner {
    private readonly registry;
    private readonly statePort;
    private readonly channelHealth;
    constructor(registry: CapabilityContractRegistry, statePort: RouteContextPort, channelHealth: ChannelHealthStore);
    planRoute(intent: CapabilityIntent, request: ConnectorRequest): Promise<ExecutionPlan>;
}
