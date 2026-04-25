export function projectOutreachQualityAudit(input) {
    return {
        eventId: input.id,
        valueScore: input.valueScore,
        noveltyScore: input.noveltyScore,
        requiredUserAction: input.requiredUserAction,
        suppressionReason: input.suppressionReason,
    };
}
