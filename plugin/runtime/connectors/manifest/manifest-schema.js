import { z } from "zod";
export const connectorRunnerKindSchema = z.enum([
    "declarative_http",
    "declarative_a2a",
    "declarative_mcp",
    "cli_descriptor",
    "custom_adapter",
    "skill",
    "browser",
    "scriptable_node",
]);
export const connectorTrustStatusSchema = z.enum([
    "declarative_trusted",
    "custom_adapter_pending_trust",
    "trusted_custom_adapter",
    "blocked",
]);
export const capabilityDeclarationSchema = z.object({
    id: z.string().min(1),
    channel: z.string().optional(),
    description: z.string().optional(),
    sourceRefs: z.array(z.string().min(1)).optional(),
    observedCount: z.number().int().positive().optional(),
});
export const runnerDeclarationSchema = z.object({
    kind: connectorRunnerKindSchema,
    entrypoint: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
});
export const credentialRequirementSchema = z.object({
    type: z.string().min(1),
    required: z.boolean().default(true),
    description: z.string().optional(),
});
export const sourceRefPolicySchema = z.object({
    minSourceRefs: z.number().int().min(0).default(1),
    rejectInlineSensitivePayload: z.boolean().optional(),
});
export const trustDeclarationSchema = z.object({
    status: connectorTrustStatusSchema.optional(),
    override: z.boolean().optional(),
    reason: z.string().optional(),
});
export const connectorManifestV6Schema = z.object({
    schemaVersion: z.literal("sn.connector.v1"),
    platformId: z.string().min(1),
    displayName: z.string().min(1),
    family: z.enum(["social_community", "agent_network", "work_platform", "custom"]),
    capabilities: z.array(capabilityDeclarationSchema).min(1),
    runner: runnerDeclarationSchema,
    credentials: z.array(credentialRequirementSchema),
    sourceRefPolicy: sourceRefPolicySchema,
    trust: trustDeclarationSchema.optional(),
});
