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
export declare const IdempotencyClassSchema: z.ZodEnum<{
    strict: "strict";
    read_only: "read_only";
    idempotent_write: "idempotent_write";
}>;
export type IdempotencyClass = z.infer<typeof IdempotencyClassSchema>;
export declare const ProbeConfigSchema: z.ZodObject<{
    safeEndpoint: z.ZodString;
    idempotencyClass: z.ZodEnum<{
        strict: "strict";
        read_only: "read_only";
        idempotent_write: "idempotent_write";
    }>;
}, z.core.$strip>;
export type ProbeConfig = z.infer<typeof ProbeConfigSchema>;
export declare const EndpointMappingsSchema: z.ZodObject<{
    profilePath: z.ZodOptional<z.ZodString>;
    claimPath: z.ZodOptional<z.ZodString>;
    heartbeatPath: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EndpointMappings = z.infer<typeof EndpointMappingsSchema>;
export declare const V7CapabilitySchema: z.ZodObject<{
    capabilityId: z.ZodString;
    intent: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    probeConfig: z.ZodOptional<z.ZodObject<{
        safeEndpoint: z.ZodString;
        idempotencyClass: z.ZodEnum<{
            strict: "strict";
            read_only: "read_only";
            idempotent_write: "idempotent_write";
        }>;
    }, z.core.$strip>>;
    endpointMappings: z.ZodOptional<z.ZodObject<{
        profilePath: z.ZodOptional<z.ZodString>;
        claimPath: z.ZodOptional<z.ZodString>;
        heartbeatPath: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type V7Capability = z.infer<typeof V7CapabilitySchema>;
export declare const ConnectorManifestV7Schema: z.ZodObject<{
    platformId: z.ZodString;
    capabilities: z.ZodArray<z.ZodObject<{
        capabilityId: z.ZodString;
        intent: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        probeConfig: z.ZodOptional<z.ZodObject<{
            safeEndpoint: z.ZodString;
            idempotencyClass: z.ZodEnum<{
                strict: "strict";
                read_only: "read_only";
                idempotent_write: "idempotent_write";
            }>;
        }, z.core.$strip>>;
        endpointMappings: z.ZodOptional<z.ZodObject<{
            profilePath: z.ZodOptional<z.ZodString>;
            claimPath: z.ZodOptional<z.ZodString>;
            heartbeatPath: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    channelPriority: z.ZodArray<z.ZodString>;
    credentialTypes: z.ZodArray<z.ZodString>;
    probeConfig: z.ZodOptional<z.ZodObject<{
        safeEndpoint: z.ZodString;
        idempotencyClass: z.ZodEnum<{
            strict: "strict";
            read_only: "read_only";
            idempotent_write: "idempotent_write";
        }>;
    }, z.core.$strip>>;
    endpointMappings: z.ZodOptional<z.ZodObject<{
        profilePath: z.ZodOptional<z.ZodString>;
        claimPath: z.ZodOptional<z.ZodString>;
        heartbeatPath: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    degradedChannels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sourceRefPolicy: z.ZodOptional<z.ZodObject<{
        minSourceRefs: z.ZodOptional<z.ZodNumber>;
        rejectInlineSensitivePayload: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConnectorManifestV7 = z.infer<typeof ConnectorManifestV7Schema>;
export interface ManifestValidationResult {
    ok: boolean;
    errors: string[];
    manifest?: ConnectorManifestV7;
}
/**
 * Parse and validate a v7 manifest object.
 * Returns detailed errors rather than throwing.
 */
export declare function validateManifestV7(input: unknown): ManifestValidationResult;
export interface ResolvedV7Capability {
    platformId: string;
    capabilityId: string;
    intent: string;
    probeConfig?: ProbeConfig;
    endpointMappings?: EndpointMappings;
}
export declare class CapabilityContractRegistryV7 {
    private readonly byPlatform;
    /**
     * Register a v7 manifest.
     * Returns `{ ok: false, errors }` on validation failure;
     * never throws for validation errors.
     */
    register(manifest: unknown): ManifestValidationResult;
    loadManifest(platformId: string): ConnectorManifestV7 | undefined;
    listRegisteredPlatformIds(): string[];
    /**
     * Resolve a capability by its `capabilityId` (namespace optional).
     * Supports `platformId:capabilityId` qualified form.
     */
    resolveCapability(capabilityIdOrQualified: string): ResolvedV7Capability | undefined;
    private _resolveOnPlatform;
    getProbeConfig(platformId: string, capabilityId: string): ProbeConfig | undefined;
    getEndpointMappings(platformId: string, capabilityId: string): EndpointMappings | undefined;
    hasCapability(platformId: string, capabilityId: string): boolean;
    listCapabilities(platformId: string): Array<{
        capabilityId: string;
        intent: string;
        hasProbeConfig: boolean;
        hasEndpointMappings: boolean;
    }>;
}
export { ConnectorManifestV7Schema as ManifestV7Schema };
