export function runQuietPipeline(input) {
    const { quietState, bundle } = input;
    if (quietState.mode !== "quiet") {
        return {
            shouldRunReflection: false,
            curation: {
                summary: "quiet_not_active",
                highlights: [],
                sourceRefs: [],
                excludedCompactionArtifacts: [],
            },
        };
    }
    const sourceRefs = new Set();
    for (const entry of bundle.journalEntries) {
        sourceRefs.add(entry.id);
    }
    for (const report of bundle.dailyReports) {
        sourceRefs.add(report.id);
    }
    const summary = `curated ${bundle.journalEntries.length} journal entries and ${bundle.dailyReports.length} daily reports`;
    const highlights = bundle.dailyReports.flatMap((report) => report.highlights).slice(0, 5);
    const shouldRunReflection = quietState.reflectionDebt > 0 ||
        quietState.missedReflectionCount > 0 ||
        (quietState.mustRunBy ? new Date(quietState.mustRunBy).getTime() <= Date.now() : false);
    return {
        shouldRunReflection,
        curation: {
            summary,
            highlights,
            sourceRefs: [...sourceRefs],
            excludedCompactionArtifacts: ["session_compaction", "context_pruning"],
        },
    };
}
