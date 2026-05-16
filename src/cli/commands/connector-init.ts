import fs from "node:fs";
import path from "node:path";

export interface ConnectorInitInput {
  platformId: string;
  family?: "social_community" | "agent_network" | "work_platform" | "custom";
  displayName?: string;
  runnerKind?:
    | "declarative_http"
    | "declarative_a2a"
    | "declarative_mcp"
    | "cli_descriptor"
    | "custom_adapter"
    | "skill"
    | "browser";
  force?: boolean;
  workspaceRoot?: string;
}

export interface ConnectorInitResult {
  ok: boolean;
  platformId: string;
  manifestPath: string;
  created: boolean;
  skipped?: boolean;
  reason?: string;
}

function resolveConnectorsDir(workspaceRoot?: string): string {
  if (workspaceRoot) {
    return path.resolve(workspaceRoot, ".second-nature", "connectors");
  }
  return path.resolve(process.cwd(), ".second-nature", "connectors");
}

function generateManifestYaml(input: ConnectorInitInput): string {
  const platformId = input.platformId;
  const displayName = input.displayName ?? platformId;
  const family = input.family ?? "custom";
  const runnerKind = input.runnerKind ?? "declarative_http";

  return `schemaVersion: sn.connector.v1
platformId: ${platformId}
displayName: ${displayName}
family: ${family}
capabilities:
  - id: ${platformId}.placeholder
    description: Placeholder capability — replace with real capability declarations
runner:
  kind: ${runnerKind}
  entrypoint: ""
credentials: []
sourceRefPolicy:
  minSourceRefs: 1
  rejectInlineSensitivePayload: true
trust:
  status: custom_adapter_pending_trust
  reason: generated_by_connector_init
`;
}

export async function connectorInit(
  input: ConnectorInitInput,
): Promise<ConnectorInitResult> {
  const { platformId, force = false } = input;

  if (!platformId || typeof platformId !== "string" || platformId.trim().length === 0) {
    return {
      ok: false,
      platformId: "",
      manifestPath: "",
      created: false,
      reason: "platformId is required and must be a non-empty string",
    };
  }

  const trimmed = platformId.trim();
  if (trimmed === "." || trimmed === "..") {
    return {
      ok: false,
      platformId: trimmed,
      manifestPath: "",
      created: false,
      reason: "platformId cannot be '.' or '..'",
    };
  }
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (sanitized !== trimmed) {
    return {
      ok: false,
      platformId,
      manifestPath: "",
      created: false,
      reason: `platformId contains invalid characters. Suggested: ${sanitized}`,
    };
  }

  const connectorsDir = resolveConnectorsDir(input.workspaceRoot);
  const platformDir = path.join(connectorsDir, sanitized);
  const manifestPath = path.join(platformDir, "manifest.yaml");

  if (fs.existsSync(manifestPath) && !force) {
    return {
      ok: true,
      platformId: sanitized,
      manifestPath,
      created: false,
      skipped: true,
      reason: "manifest already exists; use force:true to overwrite",
    };
  }

  fs.mkdirSync(platformDir, { recursive: true });
  const manifestContent = generateManifestYaml({ ...input, platformId: sanitized });
  fs.writeFileSync(manifestPath, manifestContent, "utf-8");

  return {
    ok: true,
    platformId: sanitized,
    manifestPath,
    created: true,
  };
}
