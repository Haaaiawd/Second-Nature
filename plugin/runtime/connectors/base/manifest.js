import { z } from "zod";
import { CAPABILITY_INTENTS, CHANNEL_TYPES } from "./contract.js";
const sourceRefPolicySchema = z
    .object({
    minSourceRefs: z.number().int().min(0).default(1),
    rejectInlineSensitivePayload: z.boolean().optional(),
})
    .optional();
const connectorManifestSchema = z.object({
    platformId: z.string().min(1),
    supportedCapabilities: z.array(z.enum(CAPABILITY_INTENTS)).min(1),
    channelPriority: z.array(z.enum(CHANNEL_TYPES)).min(1),
    credentialTypes: z.array(z.string().min(1)).min(1),
    degradedChannels: z.array(z.enum(CHANNEL_TYPES)).optional(),
    sourceRefPolicy: sourceRefPolicySchema,
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
    listRegisteredPlatformIds() {
        return [...this.byPlatform.keys()];
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
    /**
     * Resolve a capability string that may be namespaced (`platformId:capability`)
     * or a bare v5 capability. Returns the platform + intent pair.
     * If bare capability and no explicit platform is provided, only succeeds when
     * exactly one registered platform supports it (unambiguous_default).
     */
    resolveCapability(intentWithNamespace, explicitPlatformId) {
        const colonIndex = intentWithNamespace.indexOf(":");
        if (colonIndex >= 0) {
            const platformId = intentWithNamespace.slice(0, colonIndex);
            const intent = intentWithNamespace.slice(colonIndex + 1);
            if (!CAPABILITY_INTENTS.includes(intent)) {
                throw new Error(`capability_not_recognized:${intent}`);
            }
            if (!this.byPlatform.has(platformId)) {
                throw new Error(`platform_not_found:${platformId}`);
            }
            return { platformId, intent, source: "namespace" };
        }
        const intent = intentWithNamespace;
        if (!CAPABILITY_INTENTS.includes(intent)) {
            throw new Error(`capability_not_recognized:${intent}`);
        }
        if (explicitPlatformId) {
            if (!this.byPlatform.has(explicitPlatformId)) {
                throw new Error(`platform_not_found:${explicitPlatformId}`);
            }
            return { platformId: explicitPlatformId, intent, source: "v5_explicit" };
        }
        const platforms = this.findPlatformsForIntent(intent);
        if (platforms.length === 0) {
            throw new Error(`no_platform_supports_capability:${intent}`);
        }
        if (platforms.length > 1) {
            throw new Error(`ambiguous_capability:${intent}:${platforms.join(",")}`);
        }
        return { platformId: platforms[0], intent, source: "unambiguous_default" };
    }
    findPlatformsForIntent(intent) {
        const result = [];
        for (const [platformId, manifest] of this.byPlatform) {
            if (manifest.supportedCapabilities.includes(intent)) {
                result.push(platformId);
            }
        }
        return result;
    }
}
/** T3.1.1 contract name for manifest-first registry. */
export const ConnectorManifestRegistry = CapabilityContractRegistry;
export function describeConnector(registry, platformId) {
    return registry.loadManifest(platformId);
}
export function checkConnector(registry, platformId) {
    const errors = [];
    try {
        const manifest = registry.loadManifest(platformId);
        if (manifest.supportedCapabilities.length === 0) {
            errors.push("capability_list_empty");
        }
        if (manifest.channelPriority.length === 0) {
            errors.push("channel_priority_empty");
        }
        if (manifest.credentialTypes.length === 0) {
            errors.push("credential_types_empty");
        }
        const degraded = manifest.degradedChannels ?? [];
        for (const channel of degraded) {
            if (!manifest.channelPriority.includes(channel)) {
                errors.push(`degraded_channel_not_in_priority:${channel}`);
            }
        }
    }
    catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }
    return { ok: errors.length === 0, errors };
}
export function discoverCapabilities(registry) {
    return registry.listRegisteredPlatformIds().map((platformId) => {
        const manifest = registry.loadManifest(platformId);
        return {
            platformId,
            capabilities: [...manifest.supportedCapabilities],
            degradedChannels: manifest.degradedChannels,
        };
    });
}
export function parseConnectorManifest(input) {
    return connectorManifestSchema.parse(input);
}
