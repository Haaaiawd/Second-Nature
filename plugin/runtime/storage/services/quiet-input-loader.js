import { resolveDailyJournalPath, resolveDailyReportPath, readText } from "../memory/workspace/paths.js";
export class QuietInputLoader {
    assetRepository;
    constructor(assetRepository) {
        this.assetRepository = assetRepository;
    }
    async loadQuietInputs(query) {
        const filters = query.assetFilters ?? {
            includeJournal: true,
            includeReports: true,
            includeCurated: false,
        };
        const journalEntries = [];
        const dailyReports = [];
        if (filters.includeJournal) {
            const journalEntriesResult = await this.loadJournalEntries(query.dateRange);
            journalEntries.push(...journalEntriesResult);
        }
        if (filters.includeReports) {
            const reportEntriesResult = await this.loadReportEntries(query.dateRange);
            dailyReports.push(...reportEntriesResult);
        }
        return {
            journalEntries,
            dailyReports,
            sourceCount: journalEntries.length + dailyReports.length,
        };
    }
    async loadJournalEntries(dateRange) {
        if (!dateRange) {
            const today = new Date().toISOString().split("T")[0];
            return this.loadSingleDayJournal(today);
        }
        const entries = [];
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const current = new Date(startDate);
        while (current <= endDate) {
            const day = current.toISOString().split("T")[0];
            const dayEntries = await this.loadSingleDayJournal(day);
            entries.push(...dayEntries);
            current.setDate(current.getDate() + 1);
        }
        return entries;
    }
    async loadSingleDayJournal(day) {
        const journalPath = resolveDailyJournalPath(day);
        const content = await readText(journalPath);
        if (!content) {
            return [];
        }
        const entries = [];
        const lines = content.split("\n").filter((line) => line.trim().startsWith("- ["));
        for (const line of lines) {
            const match = line.match(/- \[(\d{4}-\d{2}-\d{2}T[\d:]+)\] (.+)/);
            if (match) {
                const [, timestamp, rest] = match;
                const categoryMatch = rest.match(/^\[(.*?)\]\s*(.*)/);
                const category = categoryMatch ? categoryMatch[1] : "unknown";
                const content = categoryMatch ? categoryMatch[2] : rest;
                entries.push({
                    id: `journal:${day}:${entries.length}`,
                    timestamp,
                    content,
                    category,
                });
            }
        }
        return entries;
    }
    async loadReportEntries(dateRange) {
        if (!dateRange) {
            const today = new Date().toISOString().split("T")[0];
            const report = await this.loadSingleDayReport(today);
            return report ? [report] : [];
        }
        const entries = [];
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const current = new Date(startDate);
        while (current <= endDate) {
            const day = current.toISOString().split("T")[0];
            const dayEntry = await this.loadSingleDayReport(day);
            if (dayEntry) {
                entries.push(dayEntry);
            }
            current.setDate(current.getDate() + 1);
        }
        return entries;
    }
    async loadSingleDayReport(day) {
        const reportPath = resolveDailyReportPath(day);
        const content = await readText(reportPath);
        if (!content) {
            return null;
        }
        const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=##|$)/);
        const highlightsMatch = content.match(/## Highlights\n([\s\S]*?)(?=##|$)/);
        const sourcesMatch = content.match(/## Sources\n([\s\S]*?)$/);
        const summary = summaryMatch ? summaryMatch[1].trim() : "";
        const highlights = [];
        if (highlightsMatch) {
            const highlightLines = highlightsMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
            for (const h of highlightLines) {
                highlights.push(h.replace(/^-\s*/, "").trim());
            }
        }
        const sources = [];
        if (sourcesMatch) {
            const sourceLines = sourcesMatch[1].split("\n").filter((l) => l.trim());
            for (const s of sourceLines) {
                const match = s.match(/- Activities: (.*)/);
                const obsMatch = s.match(/- Observations: (.*)/);
                if (match)
                    sources.push(...match[1].split(", "));
                else if (obsMatch)
                    sources.push(...obsMatch[1].split(", "));
            }
        }
        return {
            id: `report:${day}`,
            day,
            summary,
            highlights,
            sources,
        };
    }
}
export function createQuietInputLoader(assetRepository) {
    return new QuietInputLoader(assetRepository);
}
