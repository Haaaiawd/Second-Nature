import { eq } from "drizzle-orm";
import type { ObservabilityDatabase } from "../db/index.js";
import { governanceAudit } from "../db/schema/index.js";
import type { AnchorChangeAudit } from "../../shared/types/continuity.js";

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
    await this.db.db.insert(governanceAudit).values({
      id: event.id,
      eventType: "anchor_change",
      proposalId: event.proposalId,
      targetAssetId: event.targetAssetId,
      assetPath: event.assetPath,
      statusFrom: null,
      statusTo: event.status,
      beforeHash: event.beforeHash ?? null,
      afterHash: event.afterHash ?? null,
      supportingSources: JSON.stringify(event.supportingSources),
      reason: event.reason,
      verificationDeadline: null,
      attemptsRemaining: null,
      createdAt: event.createdAt,
    });
  }

  async recordCredentialLifecycle(event: CredentialLifecycleAudit): Promise<void> {
    await this.db.db.insert(governanceAudit).values({
      id: event.id,
      eventType: "credential_lifecycle",
      proposalId: null,
      targetAssetId: event.credentialId,
      assetPath: null,
      statusFrom: event.statusFrom ?? null,
      statusTo: event.statusTo,
      beforeHash: null,
      afterHash: null,
      supportingSources: "[]",
      reason: event.explanationCapsule,
      verificationDeadline: event.verificationDeadline ?? null,
      attemptsRemaining: event.attemptsRemaining ?? null,
      createdAt: event.createdAt,
    });
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
    const targetId = row.targetAssetId ?? "";
    return {
      id: row.id,
      platformId: targetId,
      credentialId: targetId,
      statusFrom: row.statusFrom ?? undefined,
      statusTo: row.statusTo,
      verificationDeadline: row.verificationDeadline ?? undefined,
      attemptsRemaining: row.attemptsRemaining ?? undefined,
      explanationCapsule: row.reason ?? "",
      createdAt: row.createdAt,
    };
  }
}
