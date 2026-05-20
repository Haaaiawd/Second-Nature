/**
 * Workspace connector behavior authoring.
 *
 * Adds a declarative capability stub to `.second-nature/connectors/{platformId}/manifest.yaml`.
 * This records a behavior the agent discovered without granting executable custom code.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { connectorManifestV6Schema } from "../../connectors/manifest/manifest-schema.js";

const PLATFORM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const BEHAVIOR_ID_PATTERN = /^[a-zA-Z0-9_.:-]+$/;

export interface ConnectorBehaviorAddInput {
  platformId: string;
  behaviorId: string;
  description?: string;
  channel?: string;
  sourceRefs?: unknown;
  observedCount?: number;
  workspaceRoot?: string;
}

export interface ConnectorBehaviorAddResult {
  ok: boolean;
  command: "connector_behavior_add";
  platformId: string;
  behaviorId: string;
  manifestPath: string;
  added: boolean;
  reason?: string;
  nextStep?: string;
}

function resolveManifestPath(workspaceRoot: string | undefined, platformId: string): string {
  const root = workspaceRoot ? path.resolve(workspaceRoot) : process.cwd();
  return path.join(root, ".second-nature", "connectors", platformId, "manifest.yaml");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeText(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : undefined;
}

function sanitizeSourceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return sanitizeText(entry, 300);
      if (entry && typeof entry === "object" && "id" in entry) {
        return sanitizeText((entry as { id?: unknown }).id, 300);
      }
      return undefined;
    })
    .filter((entry): entry is string => !!entry);
}

export async function connectorBehaviorAdd(
  input: ConnectorBehaviorAddInput,
): Promise<ConnectorBehaviorAddResult> {
  const platformId = sanitizeText(input.platformId, 128) ?? "";
  const behaviorId = sanitizeText(input.behaviorId, 160) ?? "";
  const description = sanitizeText(input.description);
  const sourceRefs = sanitizeSourceRefs(input.sourceRefs);
  const observedCount = Number.isInteger(input.observedCount) && input.observedCount! > 0
    ? input.observedCount
    : undefined;
  const manifestPath = resolveManifestPath(input.workspaceRoot, platformId || "_missing");

  if (!platformId || platformId === "." || platformId === ".." || !PLATFORM_ID_PATTERN.test(platformId)) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: "platformId is required and must use only letters, numbers, _, or -",
    };
  }
  if (!behaviorId || !BEHAVIOR_ID_PATTERN.test(behaviorId)) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: "behaviorId is required and must use only letters, numbers, _, -, ., or :",
    };
  }
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: "connector manifest not found",
      nextStep: "run connector_init for this platform first",
    };
  }

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = asRecord(yaml.load(raw, { schema: yaml.JSON_SCHEMA }));
  const parsedBefore = connectorManifestV6Schema.safeParse(manifest);
  if (!parsedBefore.success) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: `manifest schema validation failed: ${parsedBefore.error.issues.map((issue) => issue.path.join(".")).join(",")}`,
    };
  }
  const capabilities = Array.isArray(manifest.capabilities)
    ? [...manifest.capabilities]
    : [];
  const exists = capabilities.some((entry) => asRecord(entry).id === behaviorId);
  if (exists) {
    return {
      ok: true,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: "behavior already exists",
    };
  }
  if (!description && sourceRefs.length === 0) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: "behavior description or sourceRefs is required so the new action has a reviewable motive",
    };
  }

  capabilities.push({
    id: behaviorId,
    ...(description ? { description } : {}),
    ...(sanitizeText(input.channel, 64) ? { channel: sanitizeText(input.channel, 64) } : {}),
    ...(sourceRefs.length > 0 ? { sourceRefs } : {}),
    ...(observedCount ? { observedCount } : {}),
  });
  manifest.capabilities = capabilities;
  const parsedAfter = connectorManifestV6Schema.safeParse(manifest);
  if (!parsedAfter.success) {
    return {
      ok: false,
      command: "connector_behavior_add",
      platformId,
      behaviorId,
      manifestPath,
      added: false,
      reason: `manifest schema validation failed after behavior add: ${parsedAfter.error.issues.map((issue) => issue.path.join(".")).join(",")}`,
    };
  }

  const nextYaml = yaml.dump(parsedAfter.data, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(manifestPath, nextYaml, "utf-8");

  return {
    ok: true,
    command: "connector_behavior_add",
    platformId,
    behaviorId,
    manifestPath,
    added: true,
    nextStep: "run connector_status or reload the runtime registry before executing this behavior",
  };
}
