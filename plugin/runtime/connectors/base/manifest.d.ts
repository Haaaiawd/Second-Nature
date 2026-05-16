import { z } from "zod";
import { type CapabilityIntent, type ChannelType } from "./contract.js";
declare const connectorManifestSchema: z.ZodObject<{
    platformId: z.ZodString;
    supportedCapabilities: z.ZodArray<z.ZodEnum<{
        "feed.read": "feed.read";
        "post.publish": "post.publish";
        "comment.reply": "comment.reply";
        "notification.list": "notification.list";
        "message.send": "message.send";
        "agent.register": "agent.register";
        "agent.heartbeat": "agent.heartbeat";
        "work.discover": "work.discover";
        "task.claim": "task.claim";
    }>>;
    channelPriority: z.ZodArray<z.ZodEnum<{
        api_rest: "api_rest";
        api_rpc: "api_rpc";
        a2a: "a2a";
        mcp: "mcp";
        cli: "cli";
        skill: "skill";
        browser: "browser";
    }>>;
    credentialTypes: z.ZodArray<z.ZodString>;
    degradedChannels: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        api_rest: "api_rest";
        api_rpc: "api_rpc";
        a2a: "a2a";
        mcp: "mcp";
        cli: "cli";
        skill: "skill";
        browser: "browser";
    }>>>;
    sourceRefPolicy: z.ZodOptional<z.ZodObject<{
        minSourceRefs: z.ZodDefault<z.ZodNumber>;
        rejectInlineSensitivePayload: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;
export interface ResolvedConnectorCapability {
    platformId: string;
    intent: CapabilityIntent;
    source: "namespace" | "v5_explicit" | "unambiguous_default";
}
export declare class CapabilityContractRegistry {
    private readonly byPlatform;
    register(manifest: ConnectorManifest): void;
    loadManifest(platformId: string): ConnectorManifest;
    listRegisteredPlatformIds(): string[];
    hasCapability(platformId: string, intent: CapabilityIntent): boolean;
    listCapabilities(platformId: string): CapabilityIntent[];
    listChannels(platformId: string): ChannelType[];
    /**
     * Resolve a capability string that may be namespaced (`platformId:capability`)
     * or a bare v5 capability. Returns the platform + intent pair.
     * If bare capability and no explicit platform is provided, only succeeds when
     * exactly one registered platform supports it (unambiguous_default).
     */
    resolveCapability(intentWithNamespace: string, explicitPlatformId?: string): ResolvedConnectorCapability;
    findPlatformsForIntent(intent: CapabilityIntent): string[];
}
/** T3.1.1 contract name for manifest-first registry. */
export declare const ConnectorManifestRegistry: typeof CapabilityContractRegistry;
export type ConnectorManifestRegistry = CapabilityContractRegistry;
export declare function describeConnector(registry: CapabilityContractRegistry, platformId: string): ConnectorManifest;
export declare function checkConnector(registry: CapabilityContractRegistry, platformId: string): {
    ok: boolean;
    errors: string[];
};
export declare function discoverCapabilities(registry: CapabilityContractRegistry): Array<{
    platformId: string;
    capabilities: CapabilityIntent[];
    degradedChannels?: ChannelType[];
}>;
export declare function parseConnectorManifest(input: unknown): ConnectorManifest;
export {};
