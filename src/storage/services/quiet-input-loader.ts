import type { AssetRepository } from "../repositories/asset-repository.js";
import { resolveDailyJournalPath, resolveDailyReportPath, readText } from "../memory/workspace/paths.js";

export interface CurationInputQuery {
  dateRange?: {
    start: string;
    end: string;
  };
  assetFilters?: {
    includeJournal?: boolean;
    includeReports?: boolean;
    includeCurated?: boolean;
  };
}

export interface JournalEntry {
  id: string;
  timestamp: string;
  content: string;
  category: string;
}

export interface ReportEntry {
  id: string;
  day: string;
  summary: string;
  highlights: string[];
  sources: string[];
}

export interface CurationInputBundle {
  journalEntries: JournalEntry[];
  dailyReports: ReportEntry[];
  sourceCount: number;
}

export class QuietInputLoader {
  constructor(private readonly assetRepository: AssetRepository) {}

  async loadQuietInputs(query: CurationInputQuery): Promise<CurationInputBundle> {
    const filters = query.assetFilters ?? {
      includeJournal: true,
      includeReports: true,
      includeCurated: false,
    };

    const journalEntries: JournalEntry[] = [];
    const dailyReports: ReportEntry[] = [];

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

  private async loadJournalEntries(
    dateRange?: { start: string; end: string }
  ): Promise<JournalEntry[]> {
    if (!dateRange) {
      const today = new Date().toISOString().split("T")[0];
      return this.loadSingleDayJournal(today);
    }

    const entries: JournalEntry[] = [];
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

  private async loadSingleDayJournal(day: string): Promise<JournalEntry[]> {
    const journalPath = resolveDailyJournalPath(day);
    const content = await readText(journalPath);

    if (!content) {
      return [];
    }

    const entries: JournalEntry[] = [];
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

  private async loadReportEntries(
    dateRange?: { start: string; end: string }
  ): Promise<ReportEntry[]> {
    if (!dateRange) {
      const today = new Date().toISOString().split("T")[0];
      const report = await this.loadSingleDayReport(today);
      return report ? [report] : [];
    }

    const entries: ReportEntry[] = [];
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

  private async loadSingleDayReport(day: string): Promise<ReportEntry | null> {
    const reportPath = resolveDailyReportPath(day);
    const content = await readText(reportPath);

    if (!content) {
      return null;
    }

    const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=##|$)/);
    const highlightsMatch = content.match(/## Highlights\n([\s\S]*?)(?=##|$)/);
    const sourcesMatch = content.match(/## Sources\n([\s\S]*?)$/);

    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const highlights: string[] = [];
    if (highlightsMatch) {
      const highlightLines = highlightsMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
      for (const h of highlightLines) {
        highlights.push(h.replace(/^-\s*/, "").trim());
      }
    }
    const sources: string[] = [];
    if (sourcesMatch) {
      const sourceLines = sourcesMatch[1].split("\n").filter((l) => l.trim());
      for (const s of sourceLines) {
        const match = s.match(/- Activities: (.*)/);
        const obsMatch = s.match(/- Observations: (.*)/);
        if (match) sources.push(...match[1].split(", "));
        else if (obsMatch) sources.push(...obsMatch[1].split(", "));
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

export function createQuietInputLoader(assetRepository: AssetRepository): QuietInputLoader {
  return new QuietInputLoader(assetRepository);
}