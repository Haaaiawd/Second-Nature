import { eq } from "drizzle-orm";
import type { ObservabilityDatabase } from "../db/index.js";
import { governanceAudit } from "../db/schema/index.js";
import type { AnchorChangeAudit } from "../../shared/types/continuity.js";
import { createEmptyManifest, redactEvent } from "../redaction/manifest.js";
import { persistRedactionManifest } from "./redaction-store.js";

export interface CredentialLifecycleAudit {
  id: string;
  platformId: string;
  credentialId: string;
  statusFrom?: string;
  statusTo: string;
  verificationDeadline?: string;
  attemptsRemaining?: number;
  explanationCapsule: string;
  createdAt: string;
}

export class GovernanceAudit {
  constructor(private db: ObservabilityDatabase) {}

  async recordAnchorChangeAudit(event: AnchorChangeAudit): Promise<void> {
    const { redacted, manifest } = redactEvent(event);
    await this.db.db.insert(governanceAudit).values({
      id: redacted.id,
      eventType: "anchor_change",
      proposalId: redacted.proposalId,
      targetAssetId: redacted.targetAssetId,
      assetPath: redacted.assetPath,
      statusFrom: null,
      statusTo: redacted.status,
      beforeHash: redacted.beforeHash ?? null,
      afterHash: redacted.afterHash ?? null,
      supportingSources: JSON.stringify(redacted.supportingSources),
      reason: redacted.reason,
      verificationDeadline: null,
      attemptsRemaining: null,
      createdAt: redacted.createdAt,
    });
    await persistRedactionManifest(this.db, redacted.id, "anchor.change", manifest);
  }

  /**
   * Generic governance-plane events (T5.1.2): fallback_written, effect_commit_advanced, connector_failure, etc.
   * traceId is stored on target_asset_id for explain/trace correlation until a dedicated column exists.
   */
  async recordOperationalGovernanceEvent(input: {
    id: string;
    eventType: string;
    traceId: string;
    statusTo: string;
    reason: string;
    assetPath?: string;
    supportingSources?: string[];
    createdAt?: string;
  }): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    await this.db.db.insert(governanceAudit).values({
      id: input.id,
      eventType: input.eventType,
      proposalId: null,
      targetAssetId: input.traceId,
      assetPath: input.assetPath ?? null,
      statusFrom: null,
      statusTo: input.statusTo,
      beforeHash: null,
      afterHash: null,
      supportingSources: JSON.stringify(input.supportingSources ?? []),
      reason: input.reason,
      verificationDeadline: null,
      attemptsRemaining: null,
      createdAt,
    });
    await persistRedactionManifest(this.db, input.id, input.eventType, createEmptyManifest());
  }

  async recordCredentialLifecycle(event: CredentialLifecycleAudit): Promise<void> {
    const { redacted, manifest } = redactEvent(event);
    await this.db.db.insert(governanceAudit).values({
      id: redacted.id,
      eventType: "credential_lifecycle",
      proposalId: null,
      targetAssetId: redacted.platformId,
      assetPath: redacted.credentialId,
      statusFrom: redacted.statusFrom ?? null,
      statusTo: redacted.statusTo,
      beforeHash: null,
      afterHash: null,
      supportingSources: "[]",
      reason: redacted.explanationCapsule,
      verificationDeadline: redacted.verificationDeadline ?? null,
      attemptsRemaining: redacted.attemptsRemaining ?? null,
      createdAt: redacted.createdAt,
    });
    await persistRedactionManifest(this.db, redacted.id, "credential.lifecycle", manifest);
  }

  async recordProposalApply(
    proposalId: string,
    targetAssetId: string,
    assetPath: string,
    beforeHash: string | undefined,
    afterHash: string | undefined,
    supportingSources: string[],
    reason: string
  ): Promise<void> {
    const id = `anchor-${proposalId}-${Date.now()}`;
    const event: AnchorChangeAudit = {
      id,
      proposalId,
      targetAssetId,
      assetPath,
      status: "applied",
      beforeHash,
      afterHash,
      supportingSources,
      reason,
      appliedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.recordAnchorChangeAudit(event);
  }

  async recordProposalReject(
    proposalId: string,
    targetAssetId: string,
    assetPath: string,
    reason: string
  ): Promise<void> {
    const id = `anchor-reject-${proposalId}-${Date.now()}`;
    const event: AnchorChangeAudit = {
      id,
      proposalId,
      targetAssetId,
      assetPath,
      status: "rejected",
      supportingSources: [],
      reason,
      createdAt: new Date().toISOString(),
    };

    await this.recordAnchorChangeAudit(event);
  }

  async queryByProposalId(proposalId: string): Promise<AnchorChangeAudit[]> {
    const results = await this.db.db
      .select()
      .from(governanceAudit)
      .where(eq(governanceAudit.proposalId, proposalId));

    return results.map(this.mapToAnchorAudit);
  }

  async queryByAssetId(assetId: string): Promise<AnchorChangeAudit[]> {
    const results = await this.db.db
      .select()
      .from(governanceAudit)
      .where(eq(governanceAudit.targetAssetId, assetId));

    return results.map(this.mapToAnchorAudit);
  }

  async queryByEventType(eventType: string): Promise<AnchorChangeAudit[]> {
    const results = await this.db.db
      .select()
      .from(governanceAudit)
      .where(eq(governanceAudit.eventType, eventType));

    return results.map(this.mapToAnchorAudit);
  }

  async queryCredentialByPlatform(platformId: string): Promise<CredentialLifecycleAudit[]> {
    const results = await this.db.db
      .select()
      .from(governanceAudit)
      .where(eq(governanceAudit.targetAssetId, platformId));

    return results
      .filter(r => r.eventType === "credential_lifecycle")
      .map(this.mapToCredentialAudit);
  }

  private mapToAnchorAudit(row: typeof governanceAudit.$inferSelect): AnchorChangeAudit {
    return {
      id: row.id,
      proposalId: row.proposalId ?? "",
      targetAssetId: row.targetAssetId ?? "",
      assetPath: row.assetPath ?? "",
      status: row.statusTo as AnchorChangeAudit["status"],
      beforeHash: row.beforeHash ?? undefined,
      afterHash: row.afterHash ?? undefined,
      supportingSources: JSON.parse(row.supportingSources ?? "[]"),
      reason: row.reason ?? "",
      appliedAt: row.statusTo === "applied" ? row.createdAt : undefined,
      createdAt: row.createdAt,
    };
  }

  private mapToCredentialAudit(row: typeof governanceAudit.$inferSelect): CredentialLifecycleAudit {
    return {
      id: row.id,
      platformId: row.targetAssetId ?? "",
      credentialId: row.assetPath ?? "",
      statusFrom: row.statusFrom ?? undefined,
      statusTo: row.statusTo,
      verificationDeadline: row.verificationDeadline ?? undefined,
      attemptsRemaining: row.attemptsRemaining ?? undefined,
      explanationCapsule: row.reason ?? "",
      createdAt: row.createdAt,
    };
  }
}
