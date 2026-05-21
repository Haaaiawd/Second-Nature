export interface ConnectorInitInput {
    platformId: string;
    family?: "social_community" | "agent_network" | "work_platform" | "custom";
    displayName?: string;
    baseUrl?: string;
    runnerKind?: "declarative_http" | "declarative_a2a" | "declarative_mcp" | "cli_descriptor" | "custom_adapter" | "skill" | "browser";
    force?: boolean;
    workspaceRoot?: string;
}
export interface ConnectorInitResult {
    ok: boolean;
    platformId: string;
    manifestPath: string;
    adapterPath: string;
    typesPath: string;
    created: boolean;
    reason?: string;
}
export declare function connectorInit(input: ConnectorInitInput): Promise<ConnectorInitResult>;
