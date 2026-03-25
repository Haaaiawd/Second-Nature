import { eq } from "drizzle-orm";

import type { ObservabilityDatabase } from "../db/index.js";
import { decisionLedger, executionAttempts, governanceAudit } from "../db/schema/index.js";
import {
  composeEvidenceBundle,
  type EvidenceBundle,
  type EvidenceQuery,
  type EvidenceResolutionPlan,
  type GovernanceEvidenceRecord,
  type ResolvedContentRef,
} from "./compose-evidence.js";
import type { DecisionRecord, ExecutionAttempt } from "../../shared/types/continuity.js";

interface ContentResolver {
  resolve(ref: string): Promise<string | undefined>;
}

class NullContentResolver implements ContentResolver {
  async resolve(_ref: string): Promise<string | undefined> {
    return undefined;
  }
}

export class EvidenceQueryEngine {
  constructor(
    private readonly db: ObservabilityDatabase,
    private readonly contentResolver: ContentResolver = new NullContentResolver()
  ) {}

  resolveEvidencePath(query: EvidenceQuery): EvidenceResolutionPlan {
    if (query.decisionId) {
      return { key: "decisionId", path: ["decision", "attempts"] };
    }
    if (query.proposalId) {
      return { key: "proposalId", path: ["anchor_audit"] };
    }
    if (query.assetId) {
      return { key: "assetId", path: ["anchor_audit"] };
    }
    if (query.traceId) {
      return { key: "traceId", path: ["telemetry", "decision"] };
    }

    throw new Error("evidence_query_requires_index_key");
  }

  async queryEvidence(query: EvidenceQuery): Promise<EvidenceBundle> {
    if (query.sessionId) {
      throw new Error("evidence_query_sessionId_unsupported");
    }

    const plan = this.resolveEvidencePath(query);

    const decisions = await this.loadDecisions(query, plan);
    const attempts = await this.loadAttempts(query, plan, decisions);
    const governance = await this.loadGovernance(query, plan, decisions);
    const resolvedContentRefs = await this.resolveContentRefs(query, decisions, governance);

    return composeEvidenceBundle({
      query,
      plan,
      decisions,
      attempts,
      governance,
      resolvedContentRefs,
    });
  }

  private async loadDecisions(query: EvidenceQuery, plan: EvidenceResolutionPlan): Promise<DecisionRecord[]> {
    if (!plan.path.includes("decision")) {
      return [];
    }

    if (query.decisionId) {
      const rows = await this.db.db.select().from(decisionLedger).where(eq(decisionLedger.id, query.decisionId));
      return rows.map(mapDecisionRow);
    }

    if (query.traceId) {
      const rows = await this.db.db.select().from(decisionLedger).where(eq(decisionLedger.traceId, query.traceId));
      return rows.map(mapDecisionRow);
    }

    return [];
  }

  private async loadAttempts(
    query: EvidenceQuery,
    plan: EvidenceResolutionPlan,
    _decisions: DecisionRecord[]
  ): Promise<ExecutionAttempt[]> {
    if (!plan.path.includes("attempts") && !plan.path.includes("telemetry")) {
      return [];
    }

    if (query.traceId) {
      const rows = await this.db.db.select().from(executionAttempts).where(eq(executionAttempts.traceId, query.traceId));
      return rows.map(mapAttemptRow);
    }

    if (query.decisionId) {
      const rows = await this.db.db.select().from(executionAttempts).where(eq(executionAttempts.decisionId, query.decisionId));
      return rows.map(mapAttemptRow);
    }

    return [];
  }

  private async loadGovernance(
    query: EvidenceQuery,
    plan: EvidenceResolutionPlan,
    _decisions: DecisionRecord[]
  ): Promise<GovernanceEvidenceRecord[]> {
    if (!plan.path.includes("anchor_audit")) {
      return [];
    }

    if (query.proposalId) {
      const rows = await this.db.db.select().from(governanceAudit).where(eq(governanceAudit.proposalId, query.proposalId));
      return rows.map(mapGovernanceRow);
    }

    if (query.assetId) {
      const rows = await this.db.db.select().from(governanceAudit).where(eq(governanceAudit.targetAssetId, query.assetId));
      return rows.map(mapGovernanceRow);
    }

    return [];
  }

  private async resolveContentRefs(
    query: EvidenceQuery,
    decisions: DecisionRecord[],
    governance: GovernanceEvidenceRecord[]
  ): Promise<ResolvedContentRef[]> {
    if (!query.includeContentRefs) {
      return [];
    }

    const refs = new Set<string>();
    for (const decision of decisions) {
      for (const ref of decision.evidenceRefs) {
        refs.add(ref);
      }
    }
    for (const gov of governance) {
      for (const ref of gov.supportingSources) {
        refs.add(ref);
      }
    }

    const resolved: ResolvedContentRef[] = [];
    for (const ref of refs) {
      const content = await this.contentResolver.resolve(ref);
      resolved.push({ ref, resolved: typeof content === "string", content });
    }

    return resolved;
  }
}

function mapDecisionRow(row: typeof decisionLedger.$inferSelect): DecisionRecord {
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

function mapAttemptRow(row: typeof executionAttempts.$inferSelect): ExecutionAttempt {
  return {
    id: row.id,
    traceId: row.traceId,
    decisionId: row.decisionId,
    intentId: row.intentId,
    platformId: row.platformId,
    capability: row.capability,
    channel: row.channel,
    status: row.status as ExecutionAttempt["status"],
    commitState: row.commitState as ExecutionAttempt["commitState"],
    failureClass: row.failureClass ?? undefined,
    retryPolicy: row.retryPolicy ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
  };
}

function mapGovernanceRow(row: typeof governanceAudit.$inferSelect): GovernanceEvidenceRecord {
  return {
    id: row.id,
    eventType: row.eventType,
    proposalId: row.proposalId ?? undefined,
    targetAssetId: row.targetAssetId ?? undefined,
    assetPath: row.assetPath ?? undefined,
    statusFrom: row.statusFrom ?? undefined,
    statusTo: row.statusTo,
    beforeHash: row.beforeHash ?? undefined,
    afterHash: row.afterHash ?? undefined,
    supportingSources: JSON.parse(row.supportingSources ?? "[]"),
    reason: row.reason ?? undefined,
    verificationDeadline: row.verificationDeadline ?? undefined,
    attemptsRemaining: row.attemptsRemaining ?? undefined,
    createdAt: row.createdAt,
  };
}
