import { eq } from "drizzle-orm";
import type { ObservabilityDatabase } from "../db/index.js";
import { decisionLedger } from "../db/schema/index.js";
import type { DecisionRecord } from "../../shared/types/continuity.js";

export interface QuietLifecycleEvent {
  id: string;
  tickId: string;
  eventType: "quiet.entered" | "quiet.skipped" | "quiet.interrupted" | "quiet.resumed" | "quiet.suppressed";
  reason?: string;
  suppressedBy?: string;
  reflectionCandidates?: string[];
  createdAt: string;
}

export interface OutreachDecision {
  id: string;
  tickId: string;
  eventType: "outreach.considered" | "outreach.denied" | "outreach.deferred" | "outreach.sent";
  platformId?: string;
  targetUserId?: string;
  valueScore?: number;
  suppressionReason?: string;
  messagePreview?: string;
  createdAt: string;
}

export class DecisionLedger {
  constructor(private db: ObservabilityDatabase) {}

  async recordDecision(record: DecisionRecord): Promise<void> {
    await this.db.db.insert(decisionLedger).values({
      id: record.id,
      tickId: record.tickId,
      traceId: record.traceId,
      intentId: record.intentId ?? null,
      platformId: record.platformId ?? null,
      verdict: record.verdict,
      mode: record.mode,
      reasons: JSON.stringify(record.reasons),
      reasonCodes: JSON.stringify(record.reasonCodes),
      decisionBasis: record.decisionBasis,
      evidenceRefs: JSON.stringify(record.evidenceRefs),
      modelEvalRef: record.modelEvalRef ?? null,
      createdAt: record.createdAt,
    });
  }

  async recordQuietLifecycle(event: QuietLifecycleEvent): Promise<void> {
    await this.db.db.insert(decisionLedger).values({
      id: event.id,
      tickId: event.tickId,
      traceId: `quiet-${event.eventType}-${event.id}`,
      intentId: null,
      platformId: null,
      verdict: "allow",
      mode: "quiet",
      reasons: JSON.stringify([event.eventType, event.reason ?? ""].filter(Boolean)),
      reasonCodes: JSON.stringify(["quiet_lifecycle"]),
      decisionBasis: "rule_only",
      evidenceRefs: JSON.stringify(event.reflectionCandidates ?? []),
      modelEvalRef: null,
      createdAt: event.createdAt,
    });
  }

  async recordOutreachDecision(event: OutreachDecision): Promise<void> {
    await this.db.db.insert(decisionLedger).values({
      id: event.id,
      tickId: event.tickId,
      traceId: `outreach-${event.eventType}-${event.id}`,
      intentId: null,
      platformId: event.platformId ?? null,
      verdict: event.eventType === "outreach.sent" ? "allow" : "deny",
      mode: "active",
      reasons: JSON.stringify([
        event.eventType,
        event.valueScore?.toString() ?? "",
        event.suppressionReason ?? "",
      ].filter(Boolean)),
      reasonCodes: JSON.stringify(["outreach_decision"]),
      decisionBasis: "score_based",
      evidenceRefs: JSON.stringify([event.targetUserId ?? ""].filter(Boolean)),
      modelEvalRef: null,
      createdAt: event.createdAt,
    });
  }

  async queryByTickId(tickId: string): Promise<DecisionRecord[]> {
    const results = await this.db.db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.tickId, tickId));

    return results.map(this.mapToDecisionRecord);
  }

  async queryByTraceId(traceId: string): Promise<DecisionRecord | null> {
    const results = await this.db.db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.traceId, traceId))
      .limit(1);

    return results[0] ? this.mapToDecisionRecord(results[0]) : null;
  }

  async queryByIntentId(intentId: string): Promise<DecisionRecord[]> {
    const results = await this.db.db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.intentId, intentId));

    return results.map(this.mapToDecisionRecord);
  }

  private mapToDecisionRecord(row: typeof decisionLedger.$inferSelect): DecisionRecord {
    return {
      id: row.id,
      tickId: row.tickId,
      traceId: row.traceId,
      intentId: row.intentId ?? undefined,
      platformId: row.platformId ?? undefined,
      verdict: row.verdict as DecisionRecord["verdict"],
      mode: row.mode as DecisionRecord["mode"],
      reasons: JSON.parse(row.reasons),
      reasonCodes: JSON.parse(row.reasonCodes),
      decisionBasis: row.decisionBasis as DecisionRecord["decisionBasis"],
      evidenceRefs: JSON.parse(row.evidenceRefs),
      modelEvalRef: row.modelEvalRef ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
