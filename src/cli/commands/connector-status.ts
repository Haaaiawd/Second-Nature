import type { DynamicConnectorRegistry } from "../../connectors/registry/index.js";
import type { ConnectorInventoryLedger } from "../../observability/connector-inventory-ledger.js";

export interface ConnectorStatusInput {
  includeHealth?: boolean;
  workspaceRoot?: string;
}

export interface ConnectorTestInput {
  platformId: string;
  dryRun?: boolean;
}

export async function connectorStatus(
  registry: DynamicConnectorRegistry | undefined,
  ledger: ConnectorInventoryLedger | undefined,
  input?: ConnectorStatusInput,
): Promise<Record<string, unknown>> {
  if (!registry) {
    return {
      ok: false,
      command: "connector_status" as const,
      error: {
        code: "REGISTRY_UNAVAILABLE",
        message: "connector:status requires DynamicConnectorRegistry to be wired into OpsRouterDeps",
        nextStep: "wire_registry_into_ops_router",
      },
    };
  }

  // Ensure snapshot is loaded; if workspaceRoot provided, reload
  if (input?.workspaceRoot) {
    registry.reloadConnectors(input.workspaceRoot);
  }

  const snapshot = registry.getActiveRegistrySnapshot();
  const entries = [...snapshot.entries.values()];

  const conflicts = snapshot.conflicts.map((c) => ({
    platformId: c.platformId,
    existingSource: c.existingSource,
    attemptedSource: c.attemptedSource,
    reason: c.reason,
  }));

  const validationErrors = snapshot.validationErrors.map((e) => ({
    platformId: e.platformId,
    path: e.path,
    message: e.message,
  }));

  const summary = {
    total: entries.length,
    builtIn: entries.filter((e) => e.source === "built_in").length,
    workspace: entries.filter((e) => e.source === "workspace").length,
    executable: entries.filter((e) => e.executable).length,
    pendingTrust: entries.filter((e) => !e.executable).length,
  };

  // Optionally record audit
  if (ledger) {
    await ledger.recordAudit({
      snapshotId: snapshot.createdAt,
      scanned: entries.length + conflicts.length + validationErrors.length,
      registered: entries.length,
      skipped: conflicts.length + validationErrors.length,
      conflicts: conflicts.map((c) => ({ connectorId: c.platformId, reason: c.reason })),
      validationErrors: validationErrors.map((e) => ({
        connectorId: e.platformId ?? "unknown",
        errors: [e.message],
      })),
      trustSummary: {
        executable: summary.executable,
        pendingTrust: summary.pendingTrust,
      },
    });
  }

  return {
    ok: true,
    command: "connector_status" as const,
    data: {
      summary,
      connectors: entries.map((e) => ({
        platformId: e.platformId,
        source: e.source,
        trustStatus: e.trustStatus,
        executable: e.executable,
        capabilities: e.capabilities,
        validationErrors: e.validationErrors,
        manifestPath: e.manifestPath,
      })),
      conflicts,
      validationErrors,
      snapshotCreatedAt: snapshot.createdAt,
    },
  };
}

export async function connectorTest(
  registry: DynamicConnectorRegistry | undefined,
  input: ConnectorTestInput,
): Promise<Record<string, unknown>> {
  if (!registry) {
    return {
      ok: false,
      command: "connector_test" as const,
      error: {
        code: "REGISTRY_UNAVAILABLE",
        message: "connector:test requires DynamicConnectorRegistry to be wired into OpsRouterDeps",
        nextStep: "wire_registry_into_ops_router",
      },
    };
  }

  const platformId = input.platformId.trim();
  if (!platformId) {
    return {
      ok: false,
      command: "connector_test" as const,
      error: {
        code: "MISSING_PLATFORM_ID",
        message: "connector:test requires platformId",
        requiredUserInput: ["platformId"],
        nextStep: "reinvoke_with_platform_id",
      },
    };
  }

  const entry = registry.describeConnector(platformId);
  if (!entry) {
    return {
      ok: false,
      command: "connector_test" as const,
      error: {
        code: "CONNECTOR_NOT_FOUND",
        message: `No connector found for platformId: ${platformId}`,
        requiredUserInput: ["platformId"],
        nextStep: "verify_platform_id_or_run_connector_status",
      },
    };
  }

  const dryRun = input.dryRun !== false; // default dry-run

  const healthChecks: string[] = [];
  if (entry.validationErrors.length > 0) {
    healthChecks.push(`validation_errors: ${entry.validationErrors.join("; ")}`);
  }
  if (!entry.executable) {
    healthChecks.push(`not_executable: trustStatus=${entry.trustStatus}`);
  }
  if (entry.capabilities.length === 0) {
    healthChecks.push("no_capabilities_declared");
  }
  if (healthChecks.length === 0) {
    healthChecks.push("ok");
  }

  return {
    ok: true,
    command: "connector_test" as const,
    data: {
      platformId: entry.platformId,
      source: entry.source,
      trustStatus: entry.trustStatus,
      executable: entry.executable,
      capabilities: entry.capabilities,
      validationErrors: entry.validationErrors,
      manifestPath: entry.manifestPath,
      dryRun,
      healthChecks,
      note: dryRun
        ? "dry-run mode: no side effects were attempted"
        : "live test mode: side effects may have been attempted (use with caution)",
    },
  };
}
