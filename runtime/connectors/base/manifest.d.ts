import { type CapabilityIntent, type ChannelType, type ConnectorManifestLike } from "./contract.js";
export type ConnectorManifest = ConnectorManifestLike;
export declare class CapabilityContractRegistry {
    private readonly byPlatform;
    register(manifest: ConnectorManifest): void;
    loadManifest(platformId: string): ConnectorManifest;
    hasCapability(platformId: string, intent: CapabilityIntent): boolean;
    listCapabilities(platformId: string): CapabilityIntent[];
    listChannels(platformId: string): ChannelType[];
}
export declare function parseConnectorManifest(input: unknown): ConnectorManifest;
