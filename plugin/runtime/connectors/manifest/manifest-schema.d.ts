import { z } from "zod";
export declare const connectorRunnerKindSchema: z.ZodEnum<{
    skill: "skill";
    browser: "browser";
    declarative_http: "declarative_http";
    declarative_a2a: "declarative_a2a";
    declarative_mcp: "declarative_mcp";
    cli_descriptor: "cli_descriptor";
    custom_adapter: "custom_adapter";
}>;
export type ConnectorRunnerKind = z.infer<typeof connectorRunnerKindSchema>;
export declare const connectorTrustStatusSchema: z.ZodEnum<{
    blocked: "blocked";
    declarative_trusted: "declarative_trusted";
    custom_adapter_pending_trust: "custom_adapter_pending_trust";
    trusted_custom_adapter: "trusted_custom_adapter";
}>;
export type ConnectorTrustStatus = z.infer<typeof connectorTrustStatusSchema>;
export declare const capabilityDeclarationSchema: z.ZodObject<{
    id: z.ZodString;
    channel: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    sourceRefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    observedCount: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ConnectorCapabilityDeclaration = z.infer<typeof capabilityDeclarationSchema>;
export declare const runnerDeclarationSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        skill: "skill";
        browser: "browser";
        declarative_http: "declarative_http";
        declarative_a2a: "declarative_a2a";
        declarative_mcp: "declarative_mcp";
        cli_descriptor: "cli_descriptor";
        custom_adapter: "custom_adapter";
    }>;
    entrypoint: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ConnectorRunnerDeclaration = z.infer<typeof runnerDeclarationSchema>;
export declare const credentialRequirementSchema: z.ZodObject<{
    type: z.ZodString;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CredentialRequirementDeclaration = z.infer<typeof credentialRequirementSchema>;
export declare const sourceRefPolicySchema: z.ZodObject<{
    minSourceRefs: z.ZodDefault<z.ZodNumber>;
    rejectInlineSensitivePayload: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type SourceRefPolicyDeclaration = z.infer<typeof sourceRefPolicySchema>;
export declare const trustDeclarationSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        blocked: "blocked";
        declarative_trusted: "declarative_trusted";
        custom_adapter_pending_trust: "custom_adapter_pending_trust";
        trusted_custom_adapter: "trusted_custom_adapter";
    }>>;
    override: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ConnectorTrustDeclaration = z.infer<typeof trustDeclarationSchema>;
export declare const connectorManifestV6Schema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"sn.connector.v1">;
    platformId: z.ZodString;
    displayName: z.ZodString;
    family: z.ZodEnum<{
        custom: "custom";
        social_community: "social_community";
        agent_network: "agent_network";
        work_platform: "work_platform";
    }>;
    capabilities: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        channel: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        sourceRefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        observedCount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    runner: z.ZodObject<{
        kind: z.ZodEnum<{
            skill: "skill";
            browser: "browser";
            declarative_http: "declarative_http";
            declarative_a2a: "declarative_a2a";
            declarative_mcp: "declarative_mcp";
            cli_descriptor: "cli_descriptor";
            custom_adapter: "custom_adapter";
        }>;
        entrypoint: z.ZodOptional<z.ZodString>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
    credentials: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    sourceRefPolicy: z.ZodObject<{
        minSourceRefs: z.ZodDefault<z.ZodNumber>;
        rejectInlineSensitivePayload: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    trust: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            blocked: "blocked";
            declarative_trusted: "declarative_trusted";
            custom_adapter_pending_trust: "custom_adapter_pending_trust";
            trusted_custom_adapter: "trusted_custom_adapter";
        }>>;
        override: z.ZodOptional<z.ZodBoolean>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConnectorManifestV6 = z.infer<typeof connectorManifestV6Schema>;
export interface ConnectorConflict {
    platformId: string;
    existingSource: "built_in" | "workspace";
    attemptedSource: "built_in" | "workspace";
    reason: string;
}
export interface ConnectorManifestValidationError {
    platformId?: string;
    path: string;
    message: string;
}
export interface ConnectorInventoryEntry {
    platformId: string;
    source: "built_in" | "workspace";
    manifestPath?: string;
    trustStatus: ConnectorTrustStatus;
    executable: boolean;
    capabilities: string[];
    validationErrors: string[];
    conflict?: ConnectorConflict;
}
export interface ConnectorReloadResult {
    scanned: number;
    registered: number;
    skipped: number;
    conflicts: ConnectorConflict[];
    validationErrors: ConnectorManifestValidationError[];
}
export interface ConnectorRegistrySnapshot {
    readonly entries: ReadonlyMap<string, ConnectorInventoryEntry>;
    readonly builtInEntries: ReadonlyMap<string, ConnectorInventoryEntry>;
    readonly dynamicEntries: ReadonlyMap<string, ConnectorInventoryEntry>;
    readonly conflicts: readonly ConnectorConflict[];
    readonly validationErrors: readonly ConnectorManifestValidationError[];
    readonly createdAt: string;
}
