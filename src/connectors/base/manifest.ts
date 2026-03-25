import { z } from "zod";

import { CAPABILITY_INTENTS, CHANNEL_TYPES, type CapabilityIntent, type ChannelType, type ConnectorManifestLike } from "./contract.js";

const connectorManifestSchema = z.object({
  platformId: z.string().min(1),
  supportedCapabilities: z.array(z.enum(CAPABILITY_INTENTS)).min(1),
  channelPriority: z.array(z.enum(CHANNEL_TYPES)).min(1),
  credentialTypes: z.array(z.string().min(1)).min(1),
  degradedChannels: z.array(z.enum(CHANNEL_TYPES)).optional(),
});

export type ConnectorManifest = ConnectorManifestLike;

export class CapabilityContractRegistry {
  private readonly byPlatform = new Map<string, ConnectorManifest>();

  register(manifest: ConnectorManifest): void {
    const parsed = connectorManifestSchema.parse(manifest);
    this.byPlatform.set(parsed.platformId, parsed);
  }

  loadManifest(platformId: string): ConnectorManifest {
    const found = this.byPlatform.get(platformId);
    if (!found) {
      throw new Error(`connector_manifest_not_found:${platformId}`);
    }
    return found;
  }

  hasCapability(platformId: string, intent: CapabilityIntent): boolean {
    const manifest = this.loadManifest(platformId);
    return manifest.supportedCapabilities.includes(intent);
  }

  listCapabilities(platformId: string): CapabilityIntent[] {
    return [...this.loadManifest(platformId).supportedCapabilities];
  }

  listChannels(platformId: string): ChannelType[] {
    return [...this.loadManifest(platformId).channelPriority];
  }
}

export function parseConnectorManifest(input: unknown): ConnectorManifest {
  return connectorManifestSchema.parse(input);
}
