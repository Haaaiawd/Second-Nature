import { z } from "zod";
import { CAPABILITY_INTENTS, CHANNEL_TYPES } from "./contract.js";
const connectorManifestSchema = z.object({
    platformId: z.string().min(1),
    supportedCapabilities: z.array(z.enum(CAPABILITY_INTENTS)).min(1),
    channelPriority: z.array(z.enum(CHANNEL_TYPES)).min(1),
    credentialTypes: z.array(z.string().min(1)).min(1),
    degradedChannels: z.array(z.enum(CHANNEL_TYPES)).optional(),
});
export class CapabilityContractRegistry {
    byPlatform = new Map();
    register(manifest) {
        const parsed = connectorManifestSchema.parse(manifest);
        this.byPlatform.set(parsed.platformId, parsed);
    }
    loadManifest(platformId) {
        const found = this.byPlatform.get(platformId);
        if (!found) {
            throw new Error(`connector_manifest_not_found:${platformId}`);
        }
        return found;
    }
    hasCapability(platformId, intent) {
        const manifest = this.loadManifest(platformId);
        return manifest.supportedCapabilities.includes(intent);
    }
    listCapabilities(platformId) {
        return [...this.loadManifest(platformId).supportedCapabilities];
    }
    listChannels(platformId) {
        return [...this.loadManifest(platformId).channelPriority];
    }
}
export function parseConnectorManifest(input) {
    return connectorManifestSchema.parse(input);
}
