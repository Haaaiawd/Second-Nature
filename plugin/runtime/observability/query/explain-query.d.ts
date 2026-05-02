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
import type { DeliveryAuditPayload } from "../services/lived-experience-audit.js";
export type ExplainQuery = {
    kind: "decision";
    decisionId: string;
} | {
    kind: "fallback";
    fallbackRef: string;
} | {
    kind: "report";
    reportId: string;
} | {
    kind: "delivery";
    auditId: string;
} | {
    kind: "source_ref";
    sourceRefId: string;
};
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
/**
 * Query explain read model from an in-memory append-only audit slice (tests / local tooling).
 */
export declare function queryExplain(query: ExplainQuery, store: AppendOnlyAuditStore): OperatorExplainReadModel;
