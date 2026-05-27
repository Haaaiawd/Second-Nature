/**
 * Insight Extractor
 *
 * Core logic: extract source-grounded insight candidates from sampled evidence.
 * Rules-based (no LLM required) using keyword patterns, frequency counts, and
 * temporal clustering. Each insight carries type, summary, sourceRefs, and confidence.
 *
 * - Pattern: recurring themes across multiple evidence entries.
 * - Learning: new skills or behaviors observed over time.
 * - Observation: one-off notable events.
 * - Conflict: contradictory claims or repeated failures.
 * Test coverage: tests/unit/dream/t7-1-3-insight-extraction.test.ts
 */
// Keywords that indicate learning/development
const LEARNING_KEYWORDS = [
    "learned", "learn", "figured out", "discovered", "understood",
    "new approach", "different way", "better method", "improved",
];
// Keywords that indicate recurring patterns
const PATTERN_KEYWORDS = [
    "again", "regularly", "routine", "habit", "consistently",
    "every", "frequently", "pattern", "trend",
];
// Keywords that indicate conflict or failure
const CONFLICT_KEYWORDS = [
    "failed", "failure", "error", "bug", "broke", "broken",
    "conflict", "contradict", "disagree", "mismatch", "unexpected",
    "not working", "does not work", "issue", "problem",
];
function countKeywordMatches(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.reduce((count, kw) => {
        const regex = new RegExp(kw.replace(/\s+/g, "\\s+"), "g");
        const matches = lower.match(regex);
        return count + (matches ? matches.length : 0);
    }, 0);
}
function groupByDay(items) {
    const groups = new Map();
    for (const item of items) {
        const day = item.createdAt.slice(0, 10);
        const existing = groups.get(day) ?? [];
        existing.push(item.summary);
        groups.set(day, existing);
    }
    return groups;
}
function findRecurringThemes(items) {
    const themeCounts = new Map();
    for (const item of items) {
        const words = item.summary.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        for (const word of words) {
            const entry = themeCounts.get(word) ?? { count: 0, sourceIds: [] };
            entry.count++;
            if (!entry.sourceIds.includes(item.id)) {
                entry.sourceIds.push(item.id);
            }
            themeCounts.set(word, entry);
        }
    }
    return Array.from(themeCounts.entries())
        .filter(([, v]) => v.count >= 3 && v.sourceIds.length >= 2)
        .map(([theme, v]) => ({ theme, count: v.count, sourceIds: v.sourceIds }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}
export function extractInsights(input) {
    const allItems = [
        ...input.evidenceSummaries.map((e) => ({ ...e, origin: "evidence" })),
        ...input.chronicleSummaries.map((c) => ({ ...c, origin: "chronicle" })),
    ];
    const insights = [];
    const unsupportedClaims = [];
    if (allItems.length === 0) {
        return { insights: [], unsupportedClaims: ["no_evidence_for_insight"] };
    }
    // 1. Pattern insights — recurring themes
    const themes = findRecurringThemes(allItems);
    for (const theme of themes) {
        insights.push({
            id: `insight:pattern:${theme.theme}:${crypto.randomUUID()}`,
            type: "pattern",
            summary: `Recurring theme "${theme.theme}" observed across ${theme.sourceIds.length} entries`,
            sourceRefs: theme.sourceIds.slice(0, 10),
            confidence: Math.min(0.95, 0.5 + theme.count * 0.05),
        });
    }
    // 2. Learning insights — entries with learning keywords
    const learningItems = allItems.filter((item) => countKeywordMatches(item.summary, LEARNING_KEYWORDS) > 0);
    if (learningItems.length > 0) {
        insights.push({
            id: `insight:learning:${crypto.randomUUID()}`,
            type: "learning",
            summary: `Learning observed in ${learningItems.length} entries: ${learningItems[0].summary.slice(0, 60)}...`,
            sourceRefs: learningItems.map((i) => i.id).slice(0, 10),
            confidence: Math.min(0.9, 0.4 + learningItems.length * 0.1),
        });
    }
    // 3. Conflict insights — entries with conflict/failure keywords
    const conflictItems = allItems.filter((item) => countKeywordMatches(item.summary, CONFLICT_KEYWORDS) > 0);
    if (conflictItems.length >= 2) {
        insights.push({
            id: `insight:conflict:${crypto.randomUUID()}`,
            type: "conflict",
            summary: `Repeated issues observed in ${conflictItems.length} entries`,
            sourceRefs: conflictItems.map((i) => i.id).slice(0, 10),
            confidence: Math.min(0.85, 0.5 + conflictItems.length * 0.05),
        });
    }
    // 4. Observation insights — notable one-off events (high-activity days)
    const byDay = groupByDay(allItems);
    let maxDay = "";
    let maxCount = 0;
    for (const [day, summaries] of byDay) {
        if (summaries.length > maxCount) {
            maxCount = summaries.length;
            maxDay = day;
        }
    }
    if (maxCount >= 3 && maxDay) {
        const dayItems = allItems.filter((i) => i.createdAt.startsWith(maxDay));
        insights.push({
            id: `insight:observation:${crypto.randomUUID()}`,
            type: "observation",
            summary: `High activity day (${maxDay}): ${maxCount} notable events`,
            sourceRefs: dayItems.map((i) => i.id).slice(0, 10),
            confidence: Math.min(0.8, 0.4 + maxCount * 0.05),
        });
    }
    // If no insights extracted, record unsupported claim
    if (insights.length === 0) {
        unsupportedClaims.push("no_insight_patterns_detected");
    }
    return { insights, unsupportedClaims };
}
