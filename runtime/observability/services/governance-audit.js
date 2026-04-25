import { eq } from "drizzle-orm";
import { governanceAudit } from "../db/schema/index.js";
import { redactEvent } from "../redaction/manifest.js";
import { persistRedactionManifest } from "./redaction-store.js";
export class GovernanceAudit {
    db;
    constructor(db) {
        this.db = db;
    }
    async recordAnchorChangeAudit(event) {
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
    async recordCredentialLifecycle(event) {
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
    async recordProposalApply(proposalId, targetAssetId, assetPath, beforeHash, afterHash, supportingSources, reason) {
        const id = `anchor-${proposalId}-${Date.now()}`;
        const event = {
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
    async recordProposalReject(proposalId, targetAssetId, assetPath, reason) {
        const id = `anchor-reject-${proposalId}-${Date.now()}`;
        const event = {
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
    async queryByProposalId(proposalId) {
        const results = await this.db.db
            .select()
            .from(governanceAudit)
            .where(eq(governanceAudit.proposalId, proposalId));
        return results.map(this.mapToAnchorAudit);
    }
    async queryByAssetId(assetId) {
        const results = await this.db.db
            .select()
            .from(governanceAudit)
            .where(eq(governanceAudit.targetAssetId, assetId));
        return results.map(this.mapToAnchorAudit);
    }
    async queryByEventType(eventType) {
        const results = await this.db.db
            .select()
            .from(governanceAudit)
            .where(eq(governanceAudit.eventType, eventType));
        return results.map(this.mapToAnchorAudit);
    }
    async queryCredentialByPlatform(platformId) {
        const results = await this.db.db
            .select()
            .from(governanceAudit)
            .where(eq(governanceAudit.targetAssetId, platformId));
        return results
            .filter(r => r.eventType === "credential_lifecycle")
            .map(this.mapToCredentialAudit);
    }
    mapToAnchorAudit(row) {
        return {
            id: row.id,
            proposalId: row.proposalId ?? "",
            targetAssetId: row.targetAssetId ?? "",
            assetPath: row.assetPath ?? "",
            status: row.statusTo,
            beforeHash: row.beforeHash ?? undefined,
            afterHash: row.afterHash ?? undefined,
            supportingSources: JSON.parse(row.supportingSources ?? "[]"),
            reason: row.reason ?? "",
            appliedAt: row.statusTo === "applied" ? row.createdAt : undefined,
            createdAt: row.createdAt,
        };
    }
    mapToCredentialAudit(row) {
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
