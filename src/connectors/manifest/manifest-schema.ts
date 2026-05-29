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

export type ConnectorRunnerKind = z.infer<typeof connectorRunnerKindSchema>;

export const connectorTrustStatusSchema = z.enum([
  "declarative_trusted",
  "custom_adapter_pending_trust",
  "trusted_custom_adapter",
  "blocked",
]);

export type ConnectorTrustStatus = z.infer<typeof connectorTrustStatusSchema>;

export const capabilityDeclarationSchema = z.object({
  id: z.string().min(1),
  channel: z.string().optional(),
  description: z.string().optional(),
  sourceRefs: z.array(z.string().min(1)).optional(),
  observedCount: z.number().int().positive().optional(),
});

export type ConnectorCapabilityDeclaration = z.infer<typeof capabilityDeclarationSchema>;

export const runnerDeclarationSchema = z.object({
  kind: connectorRunnerKindSchema,
  entrypoint: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type ConnectorRunnerDeclaration = z.infer<typeof runnerDeclarationSchema>;

export const credentialRequirementSchema = z.object({
  type: z.string().min(1),
  required: z.boolean().default(true),
  description: z.string().optional(),
});

export type CredentialRequirementDeclaration = z.infer<typeof credentialRequirementSchema>;

export const sourceRefPolicySchema = z.object({
  minSourceRefs: z.number().int().min(0).default(1),
  rejectInlineSensitivePayload: z.boolean().optional(),
});

export type SourceRefPolicyDeclaration = z.infer<typeof sourceRefPolicySchema>;

export const trustDeclarationSchema = z.object({
  status: connectorTrustStatusSchema.optional(),
  override: z.boolean().optional(),
  reason: z.string().optional(),
});

export type ConnectorTrustDeclaration = z.infer<typeof trustDeclarationSchema>;

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
