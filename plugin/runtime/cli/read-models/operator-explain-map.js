export function mapOperatorExplainToReadModel(op, subjectKind) {
    return {
        subjectType: subjectKind,
        conclusion: op.summary,
        keyFactors: op.events.map((e) => `${e.eventId}:${e.summary}`),
        evidenceRefs: op.relatedEventIds.map((id) => `audit_event:${id}`),
        warnings: op.warnings.length ? op.warnings : undefined,
        relatedAuditEventIds: op.relatedEventIds.length ? op.relatedEventIds : undefined,
    };
}
