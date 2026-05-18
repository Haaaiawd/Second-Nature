/**
 * Operator explain query over append-only audit envelopes (T5.3.1).
 *
 * Core logic: resolve subject to matching envelopes, compose summary + no-user-visible-contact warnings,
 * expose minimal redacted event list for JSON-first read models.
 *
 * Dependencies: AppendOnlyAuditStore list; audit-envelope types; delivery audit payload shape from lived-experience-audit.
 *
 * Test coverage: tests/integration/observability/explain-query-export.test.ts
 */
import type { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
import type { AuditEnvelope } from "../audit/audit-envelope.js";
import type { DeliveryAuditPayload } from "../services/lived-experience-audit.js";

export type ExplainQuery =
  | { kind: "decision"; decisionId: string }
  | { kind: "fallback"; fallbackRef: string }
  | { kind: "report"; reportId: string }
  | { kind: "delivery"; auditId: string }
  | { kind: "source_ref"; sourceRefId: string }
  | { kind: "relationship"; relationshipId: string };

export interface RedactedExplainEvent {
  eventId: string;
  family: string;
  plane: string;
  createdAt: string;
  /** Minimal safe summary — no raw recipient / tokens */
  summary: string;
}

export interface OperatorExplainReadModel {
  query: ExplainQuery;
  summary: string;
  warnings: string[];
  deliveryStatus?: DeliveryAuditPayload["status"];
  relatedEventIds: string[];
  events: RedactedExplainEvent[];
}

const NO_USER_VISIBLE = "no_user_visible_contact_claim_prohibited";

function isNoUserVisibleDelivery(status: string | undefined): boolean {
  if (!status) return false;
  return (
    status === "target_none" ||
    status === "not_sent_fallback" ||
    status === "channel_missing" ||
    status === "host_unsupported" ||
    status === "failed" ||
    status === "ack_dropped"
  );
}

function payloadDecisionId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const v = p.decisionId;
  return typeof v === "string" ? v : undefined;
}

function payloadFallbackRef(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const v = p.fallbackRef;
  return typeof v === "string" ? v : undefined;
}

function payloadAuditId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const a = p.auditId;
  if (typeof a === "string") return a;
  return undefined;
}

function deliveryStatusFrom(payload: unknown): DeliveryAuditPayload["status"] | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  const s = p.status;
  return typeof s === "string" ? (s as DeliveryAuditPayload["status"]) : undefined;
}

function eventMatchesQuery(envelope: AuditEnvelope<unknown>, query: ExplainQuery): boolean {
  const payload = envelope.payload;
  switch (query.kind) {
    case "decision":
      return payloadDecisionId(payload) === query.decisionId;
    case "fallback":
      return payloadFallbackRef(payload) === query.fallbackRef;
    case "report":
      return envelope.eventId === query.reportId || payloadAuditId(payload) === query.reportId;
    case "delivery":
      return (
        envelope.family === "delivery" &&
        (envelope.eventId === query.auditId || payloadAuditId(payload) === query.auditId)
      );
    case "source_ref": {
      const needle = query.sourceRefId;
      try {
        return JSON.stringify(payload).includes(needle);
      } catch {
        return false;
      }
    }
    case "relationship": {
      const needle = query.relationshipId;
      try {
        return JSON.stringify(payload).includes(needle);
      } catch {
        return false;
      }
    }
  }
}

function summarizeEnvelope(e: AuditEnvelope<unknown>): string {
  const fam = e.family;
  if (fam === "delivery") {
    const st = deliveryStatusFrom(e.payload);
    return `delivery_audit:${st ?? "unknown"}`;
  }
  if (fam === "heartbeat.decision") {
    const outcome = (e.payload as Record<string, unknown> | undefined)?.outcome;
    return `decision:${typeof outcome === "string" ? outcome : "unknown"}`;
  }
  return `${fam}`;
}

/**
 * Query explain read model from an in-memory append-only audit slice (tests / local tooling).
 */
export function queryExplain(query: ExplainQuery, store: AppendOnlyAuditStore): OperatorExplainReadModel {
  const matched = store.list().filter((e) => eventMatchesQuery(e, query));
  const relatedEventIds = matched.map((e) => e.eventId);
  const warnings: string[] = [];
  let deliveryStatus: DeliveryAuditPayload["status"] | undefined;

  for (const e of matched) {
    if (e.family === "delivery") {
      const st = deliveryStatusFrom(e.payload);
      if (st) deliveryStatus = st;
      if (isNoUserVisibleDelivery(st)) {
        warnings.push(NO_USER_VISIBLE);
      }
    }
  }

  const uniqueWarnings = [...new Set(warnings)];
  const summary =
    matched.length === 0
      ? "no_matching_audit_events"
      : `matched_events=${matched.length};subject=${query.kind}`;

  const events: RedactedExplainEvent[] = matched.map((e) => ({
    eventId: e.eventId,
    family: e.family,
    plane: e.plane,
    createdAt: e.createdAt,
    summary: summarizeEnvelope(e),
  }));

  return {
    query,
    summary,
    warnings: uniqueWarnings,
    deliveryStatus,
    relatedEventIds,
    events,
  };
}
