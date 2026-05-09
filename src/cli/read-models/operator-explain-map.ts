/**
 * Maps T5.3.1 operator explain query results into CLI ExplainReadModel (T1.2.1).
 */
import type { OperatorExplainReadModel } from "../../observability/query/explain-query.js";
import type { ExplainReadModel, ExplainSubjectKind } from "./types.js";

export function mapOperatorExplainToReadModel(op: OperatorExplainReadModel, subjectKind: ExplainSubjectKind): ExplainReadModel {
  return {
    subjectType: subjectKind,
    conclusion: op.summary,
    keyFactors: op.events.map((e) => `${e.eventId}:${e.summary}`),
    evidenceRefs: op.relatedEventIds.map((id) => `audit_event:${id}`),
    warnings: op.warnings.length ? op.warnings : undefined,
    relatedAuditEventIds: op.relatedEventIds.length ? op.relatedEventIds : undefined,
  };
}
