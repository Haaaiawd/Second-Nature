/**
 * Manifest v7 Schema + CapabilityContractRegistry v7 Extension — T-CS.C.1
 *
 * Core logic: Extends v6 manifest with v7 fields:
 * - `probeConfig` (safeEndpoint, idempotencyClass)
 * - `endpointMappings` (profilePath, claimPath, heartbeatPath)
 * - `capabilityId` per capability (DR-001 fix)
 *
 * Zod strict validation with detailed error messages on registration failure.
 *
 * Dependencies:
 * - Zod for schema validation
 * - v6 `CapabilityContractRegistry` from `./manifest.js` as baseline
 *
 * Boundary:
 * - `ConnectorManifestV7` is a superset of v6 manifest fields.
 * - `CapabilityContractRegistryV7` wraps/extends the base registry with
 *   v7-specific lookups (`resolveCapabilityV7`, `getProbeConfig`,
 *   `getEndpointMapping`).
 * - Registration failures return `{ ok: false; errors: string[] }` instead of
 *   throwing.
 *
 * Test coverage: tests/unit/connectors/manifest-v7-schema.test.ts
 */
import { z } from "zod";
// ─── V7 Capability Schema ───────────────────────────────────────────────────
export const IdempotencyClassSchema = z.enum([
    "read_only",
    "idempotent_write",
    "strict",
]);
export const ProbeConfigSchema = z.object({
    safeEndpoint: z.string().min(1),
    idempotencyClass: IdempotencyClassSchema,
});
export const EndpointMappingsSchema = z.object({
    profilePath: z.string().min(1).optional(),
    claimPath: z.string().min(1).optional(),
    heartbeatPath: z.string().min(1).optional(),
});
export const V7CapabilitySchema = z.object({
    capabilityId: z.string().min(1),
    intent: z.string().min(1).regex(/^[a-zA-Z0-9_.:-]+$/),
    description: z.string().optional(),
    probeConfig: ProbeConfigSchema.optional(),
    endpointMappings: EndpointMappingsSchema.optional(),
});
// ─── V7 Manifest Schema ─────────────────────────────────────────────────────
export const ConnectorManifestV7Schema = z.object({
    platformId: z.string().min(1),
    capabilities: z.array(V7CapabilitySchema).min(1),
    channelPriority: z.array(z.string().min(1)).min(1),
    credentialTypes: z.array(z.string().min(1)).min(1),
    probeConfig: ProbeConfigSchema.optional(),
    endpointMappings: EndpointMappingsSchema.optional(),
    degradedChannels: z.array(z.string().min(1)).optional(),
    sourceRefPolicy: z
        .object({
        minSourceRefs: z.number().int().min(0).optional(),
        rejectInlineSensitivePayload: z.boolean().optional(),
    })
        .optional(),
});
/**
 * Parse and validate a v7 manifest object.
 * Returns detailed errors rather than throwing.
 */
export function validateManifestV7(input) {
    const parsed = ConnectorManifestV7Schema.safeParse(input);
    if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
        return { ok: false, errors };
    }
    return { ok: true, errors: [], manifest: parsed.data };
}
export class CapabilityContractRegistryV7 {
    byPlatform = new Map();
    /**
     * Register a v7 manifest.
     * Returns `{ ok: false, errors }` on validation failure;
     * never throws for validation errors.
     */
    register(manifest) {
        const validation = validateManifestV7(manifest);
        if (!validation.ok) {
            return validation;
        }
        const parsed = validation.manifest;
        // DR-001: capabilityId must be present on every capability
        const missingIds = [];
        for (const cap of parsed.capabilities) {
            if (!cap.capabilityId || cap.capabilityId.trim().length === 0) {
                missingIds.push(cap.intent);
            }
        }
        if (missingIds.length > 0) {
            return {
                ok: false,
                errors: missingIds.map((intent) => `capabilities: capabilityId missing for intent "${intent}"`),
            };
        }
        this.byPlatform.set(parsed.platformId, parsed);
        return { ok: true, errors: [] };
    }
    loadManifest(platformId) {
        return this.byPlatform.get(platformId);
    }
    listRegisteredPlatformIds() {
        return [...this.byPlatform.keys()];
    }
    /**
     * Resolve a capability by its `capabilityId` (namespace optional).
     * Supports `platformId:capabilityId` qualified form.
     */
    resolveCapability(capabilityIdOrQualified) {
        const colonIndex = capabilityIdOrQualified.indexOf(":");
        if (colonIndex >= 0) {
            const platformId = capabilityIdOrQualified.slice(0, colonIndex);
            const capabilityId = capabilityIdOrQualified.slice(colonIndex + 1);
            return this._resolveOnPlatform(platformId, capabilityId);
        }
        // Search all platforms for first matching capabilityId
        for (const platformId of this.byPlatform.keys()) {
            const found = this._resolveOnPlatform(platformId, capabilityIdOrQualified);
            if (found)
                return found;
        }
        return undefined;
    }
    _resolveOnPlatform(platformId, capabilityIdOrIntent) {
        const manifest = this.byPlatform.get(platformId);
        if (!manifest)
            return undefined;
        // Match by capabilityId (exact) or intent (fallback)
        const cap = manifest.capabilities.find((c) => c.capabilityId === capabilityIdOrIntent) ??
            manifest.capabilities.find((c) => c.intent === capabilityIdOrIntent);
        if (!cap)
            return undefined;
        return {
            platformId,
            capabilityId: cap.capabilityId,
            intent: cap.intent,
            probeConfig: cap.probeConfig ?? manifest.probeConfig,
            endpointMappings: cap.endpointMappings ?? manifest.endpointMappings,
        };
    }
    getProbeConfig(platformId, capabilityId) {
        const resolved = this._resolveOnPlatform(platformId, capabilityId);
        return resolved?.probeConfig;
    }
    getEndpointMappings(platformId, capabilityId) {
        const resolved = this._resolveOnPlatform(platformId, capabilityId);
        return resolved?.endpointMappings;
    }
    hasCapability(platformId, capabilityId) {
        return this._resolveOnPlatform(platformId, capabilityId) !== undefined;
    }
    listCapabilities(platformId) {
        const manifest = this.byPlatform.get(platformId);
        if (!manifest)
            return [];
        return manifest.capabilities.map((cap) => ({
            capabilityId: cap.capabilityId,
            intent: cap.intent,
            hasProbeConfig: !!cap.probeConfig || !!manifest.probeConfig,
            hasEndpointMappings: !!cap.endpointMappings || !!manifest.endpointMappings,
        }));
    }
}
export { ConnectorManifestV7Schema as ManifestV7Schema };
