export function formatExplanation(model) {
    return {
        subjectType: model.subjectType,
        conclusion: model.conclusion,
        keyFactors: model.keyFactors,
        evidenceRefs: model.evidenceRefs,
        requiredUserInput: model.requiredUserInput,
        nextStep: model.nextStep,
        warnings: model.warnings,
        relatedAuditEventIds: model.relatedAuditEventIds,
    };
}
