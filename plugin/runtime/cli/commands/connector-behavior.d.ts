export interface ConnectorBehaviorAddInput {
    platformId: string;
    behaviorId: string;
    description?: string;
    channel?: string;
    workspaceRoot?: string;
}
export interface ConnectorBehaviorAddResult {
    ok: boolean;
    command: "connector_behavior_add";
    platformId: string;
    behaviorId: string;
    manifestPath: string;
    added: boolean;
    reason?: string;
    nextStep?: string;
}
export declare function connectorBehaviorAdd(input: ConnectorBehaviorAddInput): Promise<ConnectorBehaviorAddResult>;
