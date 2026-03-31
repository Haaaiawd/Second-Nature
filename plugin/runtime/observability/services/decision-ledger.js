import { eq } from "drizzle-orm";
import { decisionLedger } from "../db/schema/index.js";
import { redactEvent } from "../redaction/manifest.js";
import { persistRedactionManifest } from "./redaction-store.js";
export class DecisionLedger {
    db;
    constructor(db) {
        this.db = db;
    }
    async recordDecision(record) {
        const { redacted, manifest } = redactEvent(record);
        await this.db.db.insert(decisionLedger).values({
            id: redacted.id,
            tickId: redacted.tickId,
            traceId: redacted.traceId,
            intentId: redacted.intentId ?? null,
            platformId: redacted.platformId ?? null,
            verdict: redacted.verdict,
            mode: redacted.mode,
            reasons: JSON.stringify(redacted.reasons),
            reasonCodes: JSON.stringify(redacted.reasonCodes),
            decisionBasis: redacted.decisionBasis,
            evidenceRefs: JSON.stringify(redacted.evidenceRefs),
            modelEvalRef: redacted.modelEvalRef ?? null,
            createdAt: redacted.createdAt,
        });
        await persistRedactionManifest(this.db, redacted.id, "decision.recorded", manifest);
    }
    async recordQuietLifecycle(event) {
        const { redacted, manifest } = redactEvent(event);
        await this.db.db.insert(decisionLedger).values({
            id: redacted.id,
            tickId: redacted.tickId,
            traceId: `quiet-${redacted.eventType}-${redacted.id}`,
            intentId: null,
            platformId: null,
            verdict: "allow",
            mode: "quiet",
            reasons: JSON.stringify([redacted.eventType, redacted.reason ?? ""].filter(Boolean)),
            reasonCodes: JSON.stringify(["quiet_lifecycle"]),
            decisionBasis: "rule_only",
            evidenceRefs: JSON.stringify(redacted.reflectionCandidates ?? []),
            modelEvalRef: null,
            createdAt: redacted.createdAt,
        });
        await persistRedactionManifest(this.db, redacted.id, redacted.eventType, manifest);
    }
    async recordOutreachDecision(event) {
        const { redacted, manifest } = redactEvent(event);
        const verdict = redacted.eventType === "outreach.sent"
            ? "allow"
            : redacted.eventType === "outreach.deferred" || redacted.eventType === "outreach.considered"
                ? "defer"
                : "deny";
        await this.db.db.insert(decisionLedger).values({
            id: redacted.id,
            tickId: redacted.tickId,
            traceId: `outreach-${redacted.eventType}-${redacted.id}`,
            intentId: null,
            platformId: redacted.platformId ?? null,
            verdict,
            mode: "active",
            reasons: JSON.stringify([
                redacted.eventType,
                redacted.valueScore?.toString() ?? "",
                redacted.suppressionReason ?? "",
            ].filter(Boolean)),
            reasonCodes: JSON.stringify(["outreach_decision"]),
            decisionBasis: "score_based",
            evidenceRefs: JSON.stringify([redacted.targetUserId ?? ""].filter(Boolean)),
            modelEvalRef: null,
            createdAt: redacted.createdAt,
        });
        await persistRedactionManifest(this.db, redacted.id, redacted.eventType, manifest);
    }
    async queryByTickId(tickId) {
        const results = await this.db.db
            .select()
            .from(decisionLedger)
            .where(eq(decisionLedger.tickId, tickId));
        return results.map(this.mapToDecisionRecord);
    }
    async queryByTraceId(traceId) {
        const results = await this.db.db
            .select()
            .from(decisionLedger)
            .where(eq(decisionLedger.traceId, traceId))
            .limit(1);
        return results[0] ? this.mapToDecisionRecord(results[0]) : null;
    }
    async queryByIntentId(intentId) {
        const results = await this.db.db
            .select()
            .from(decisionLedger)
            .where(eq(decisionLedger.intentId, intentId));
        return results.map(this.mapToDecisionRecord);
    }
    mapToDecisionRecord(row) {
        return {
            id: row.id,
            tickId: row.tickId,
            traceId: row.traceId,
            intentId: row.intentId ?? undefined,
            platformId: row.platformId ?? undefined,
            verdict: row.verdict,
            mode: row.mode,
            reasons: JSON.parse(row.reasons),
            reasonCodes: JSON.parse(row.reasonCodes),
            decisionBasis: row.decisionBasis,
            evidenceRefs: JSON.parse(row.evidenceRefs),
            modelEvalRef: row.modelEvalRef ?? undefined,
            createdAt: row.createdAt,
        };
    }
}
