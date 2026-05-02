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
export declare class CapabilityContractRegistry {
    private readonly byPlatform;
    register(manifest: ConnectorManifest): void;
    loadManifest(platformId: string): ConnectorManifest;
    listRegisteredPlatformIds(): string[];
    hasCapability(platformId: string, intent: CapabilityIntent): boolean;
    listCapabilities(platformId: string): CapabilityIntent[];
    listChannels(platformId: string): ChannelType[];
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
