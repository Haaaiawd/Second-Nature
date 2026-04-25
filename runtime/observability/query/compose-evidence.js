function collectEvidenceRefs(decisions, governance) {
    const refs = new Set();
    for (const record of decisions) {
        for (const ref of record.evidenceRefs) {
            refs.add(ref);
        }
    }
    for (const record of governance) {
        for (const ref of record.supportingSources) {
            refs.add(ref);
        }
    }
    return [...refs];
}
export function composeEvidenceBundle(input) {
    const { query, plan, decisions, attempts, governance, resolvedContentRefs } = input;
    const evidenceRefs = collectEvidenceRefs(decisions, governance);
    const keyFactors = [
        ...new Set([
            ...decisions.flatMap((d) => d.reasonCodes),
            ...attempts.map((a) => a.failureClass).filter((x) => Boolean(x)),
            ...governance.map((g) => g.eventType),
        ]),
    ];
    const conclusion = decisions.length > 0
        ? `找到 ${decisions.length} 条决策证据与 ${attempts.length} 条执行证据。`
        : governance.length > 0
            ? `找到 ${governance.length} 条治理证据。`
            : "仅找到有限证据，建议补充查询键。";
    return {
        query,
        plan,
        decisions,
        attempts,
        governance,
        resolvedContentRefs,
        explanation: {
            conclusion,
            keyFactors,
            evidenceRefs,
        },
    };
}
