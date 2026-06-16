/**
 * Decision trace, delivery audit, source coverage, guidance grounding + explain index (T5.2.1).
 *
 * Core logic: append-only envelopes with hash chain; explain index links decisionId to events and
 * flags when delivery audit indicates no user-visible contact (target_none / not_sent_fallback).
 * Test coverage: tests/unit/observability/lived-experience-audit.test.ts
 */
import * as crypto from "node:crypto";
import { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
import { buildAuditEnvelope, type AuditPlane } from "../audit/audit-envelope.js";
import type { LifeEvidenceSourceRef } from "../../storage/life-evidence/types.js";
import type { DreamTrace } from "../../dream/types.js";

export type RuntimeScope = "rhythm" | "user_task" | "user_reply";

export type HeartbeatOutcome =
  | "heartbeat_ok"
  | "intent_selected"
  | "denied"
  | "deferred"
  | "runtime_carrier_only"
  | "delivery_unavailable";

export type DeliveryAuditStatus =
  | "not_requested"
  | "target_available"
  | "target_none"
  | "channel_missing"
  | "host_unsupported"
  | "ack_dropped"
  | "sent"
  | "failed"
  | "not_sent_fallback";

export type GroundingStatus = "pass" | "degraded" | "blocked";

export interface DecisionTracePayload {
  decisionId: string;
  traceId: string;
  heartbeatId?: string;
  runtimeScope: RuntimeScope;
  outcome: HeartbeatOutcome;
  selectedIntentId?: string;
  candidateId?: string;
  rhythmWindowKind?: string;
  hardGuardVerdict?: "allow" | "deny" | "defer" | "silent";
  outreachVerdict?: "allow" | "deny" | "defer";
  deliveryAuditId?: string;
  reasonCodes: string[];
  sourceRefs: LifeEvidenceSourceRef[];
  snapshotRef?: LifeEvidenceSourceRef;
  createdAt: string;
}

export interface DeliveryAuditPayload {
  auditId: string;
  decisionId: string;
  traceId: string;
  target?: "none" | "last" | "explicit";
  channel?: string;
  recipientRef?: string;
  status: DeliveryAuditStatus;
  messageId?: string;
  hostProofRef?: LifeEvidenceSourceRef;
  fallbackRef?: string;
  ackDropMatched?: boolean;
  hostVersion?: string;
  reasonCodes: string[];
  createdAt: string;
}

export interface SourceCoverageAuditPayload {
  auditId: string;
  traceId: string;
  /** When set, explain index links this audit to the decision timeline. */
  decisionId?: string;
  subjectType: "quiet_artifact" | "outreach_draft" | "guidance_payload" | "decision_trace" | "host_report";
  subjectRef: string;
  usedSourceRefs: LifeEvidenceSourceRef[];
  unresolvedRefs: LifeEvidenceSourceRef[];
  coverageRatio: number;
  unsupportedClaims: string[];
  status: GroundingStatus;
  reasonCodes: string[];
  createdAt: string;
}

export interface GuidanceGroundingAuditPayload {
  auditId: string;
  traceId: string;
  decisionId?: string;
  requestId: string;
  draftId?: string;
  sceneType:
    | "outreach"
    | "quiet_reflection"
    | "social"
    | "explain"
    | "user_reply_continuity"
    | "fallback_candidate";
  groundingStatus: GroundingStatus;
  usedSourceRefs: LifeEvidenceSourceRef[];
  unsupportedClaims: string[];
  guardViolations: string[];
  deliveryWording?: "sendable" | "not_sent_fallback_candidate";
  createdAt: string;
}

export interface NarrativeTracePayload {
  traceId: string;
  narrativeId: string;
  revision: number;
  updateSource: "heartbeat" | "dream" | "owner" | "maintenance";
  sourceRefs: Array<{ id: string; kind: string; uri?: string }>;
  unsupportedClaims: string[];
  groundingStatus: GroundingStatus;
  goalInfluenceRefs: string[];
  createdAt: string;
}

export interface ExplainLinkageSummary {
  decisionId: string;
  summary: string;
  warnings: string[];
  deliveryStatus?: DeliveryAuditStatus;
  relatedEventIds: string[];
}

interface IndexEntry {
  traceIds: Set<string>;
  eventIds: string[];
  deliveryStatuses: DeliveryAuditStatus[];
  fallbackRefs: string[];
  noUserVisibleContact: boolean;
}

function validateDecisionTrace(t: DecisionTracePayload): void {
  if (!t.decisionId?.trim()) throw new Error("decision_trace_requires_decision_id");
  if (!t.traceId?.trim()) throw new Error("decision_trace_requires_trace_id");
  if (!t.outcome) throw new Error("decision_trace_requires_outcome");
}

function validateDeliveryAudit(a: DeliveryAuditPayload): void {
  if (!a.auditId?.trim()) throw new Error("delivery_audit_requires_audit_id");
  if (!a.decisionId?.trim()) throw new Error("delivery_audit_requires_decision_id");
  if (a.status === "sent") {
    const ok = Boolean(a.messageId?.trim()) || Boolean(a.hostProofRef);
    if (!ok) throw new Error("delivery_audit_sent_requires_message_id_or_host_proof_ref");
  }
}

export class LivedExperienceAuditRecorder {
  private seq = 0;
  private readonly explainIndex = new Map<string, IndexEntry>();

  constructor(private readonly store: AppendOnlyAuditStore) {}

  private bumpSequence(): number {
    this.seq += 1;
    return this.seq;
  }

  private touchDecision(decisionId: string, traceId: string, eventId: string): IndexEntry {
    let e = this.explainIndex.get(decisionId);
    if (!e) {
      e = { traceIds: new Set(), eventIds: [], deliveryStatuses: [], fallbackRefs: [], noUserVisibleContact: false };
      this.explainIndex.set(decisionId, e);
    }
    e.traceIds.add(traceId);
    e.eventIds.push(eventId);
    return e;
  }

  recordDecisionTrace(payload: DecisionTracePayload): { eventId: string } {
    validateDecisionTrace(payload);
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "heartbeat.decision",
      plane: "decision",
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("heartbeat.decision"),
      eventId: crypto.randomUUID(),
      createdAt: payload.createdAt,
    });
    this.store.append(envelope);
    const entry = this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
    if (
      payload.outcome === "heartbeat_ok" &&
      payload.reasonCodes.some((c) => c.includes("target_none") || c === "target_none")
    ) {
      entry.noUserVisibleContact = true;
    }
    return { eventId: envelope.eventId };
  }

  recordDeliveryAudit(payload: DeliveryAuditPayload): { eventId: string } {
    validateDeliveryAudit(payload);
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "delivery",
      plane: "delivery" as AuditPlane,
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("delivery"),
      eventId: payload.auditId,
      createdAt: payload.createdAt,
    });
    this.store.append(envelope);
    const entry = this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
    entry.deliveryStatuses.push(payload.status);
    if (payload.fallbackRef) entry.fallbackRefs.push(payload.fallbackRef);
    if (
      payload.status === "target_none" ||
      payload.status === "not_sent_fallback" ||
      payload.status === "channel_missing" ||
      payload.status === "host_unsupported" ||
      payload.status === "failed" ||
      payload.status === "ack_dropped"
    ) {
      entry.noUserVisibleContact = true;
    }
    return { eventId: envelope.eventId };
  }

  recordSourceCoverage(payload: SourceCoverageAuditPayload): { eventId: string } {
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "source_coverage",
      plane: "source_coverage" as AuditPlane,
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("source_coverage"),
      eventId: payload.auditId,
      createdAt: payload.createdAt,
    });
    this.store.append(envelope);
    if (payload.decisionId) {
      this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
    }
    return { eventId: envelope.eventId };
  }

  recordGuidanceGrounding(payload: GuidanceGroundingAuditPayload): { eventId: string } {
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "guidance.grounding",
      plane: "source_coverage" as AuditPlane,
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("guidance.grounding"),
      eventId: payload.auditId,
      createdAt: payload.createdAt,
    });
    this.store.append(envelope);
    if (payload.decisionId) {
      this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
    }
    return { eventId: envelope.eventId };
  }

  recordNarrativeTrace(payload: NarrativeTracePayload): { eventId: string } {
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "narrative.trace",
      plane: "source_coverage" as AuditPlane,
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("narrative.trace"),
      eventId: crypto.randomUUID(),
      createdAt: payload.createdAt,
    });
    this.store.append(envelope);
    return { eventId: envelope.eventId };
  }

  recordDreamTrace(payload: DreamTrace): { eventId: string } {
    const seq = this.bumpSequence();
    const envelope = buildAuditEnvelope({
      family: "dream.trace",
      plane: "telemetry" as AuditPlane,
      traceId: payload.traceId,
      sequence: seq,
      payload,
      previousHash: this.store.lastRecordHash("dream.trace"),
      eventId: crypto.randomUUID(),
      createdAt: payload.finishedAt,
    });
    this.store.append(envelope);
    return { eventId: envelope.eventId };
  }

  explainLinkageForDecision(decisionId: string): ExplainLinkageSummary {
    const entry = this.explainIndex.get(decisionId);
    const warnings: string[] = [];
    if (!entry) {
      return {
        decisionId,
        summary: "no_audit_events_indexed_for_decision",
        warnings: ["no_indexed_events"],
        relatedEventIds: [],
      };
    }
    if (entry.noUserVisibleContact) {
      warnings.push("no_user_visible_contact_claim_prohibited");
    }
    const lastDelivery = entry.deliveryStatuses[entry.deliveryStatuses.length - 1];
    return {
      decisionId,
      summary: `indexed_events=${entry.eventIds.length};delivery=${lastDelivery ?? "unknown"}`,
      warnings,
      deliveryStatus: lastDelivery,
      relatedEventIds: [...entry.eventIds],
    };
  }
}

export function createLivedExperienceAuditRecorder(store?: AppendOnlyAuditStore): LivedExperienceAuditRecorder {
  return new LivedExperienceAuditRecorder(store ?? new AppendOnlyAuditStore());
}
