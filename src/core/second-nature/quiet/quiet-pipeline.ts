import type { TopLevelMode } from "../types.js";

export interface QuietInputBundle {
  journalEntries: Array<{ id: string; content: string; timestamp: string; sourceRefs?: string[] }>;
  dailyReports: Array<{ id: string; summary: string; highlights: string[]; sources: string[] }>;
}

export interface MemoryCurationResult {
  summary: string;
  highlights: string[];
  sourceRefs: string[];
  excludedCompactionArtifacts: string[];
}

export interface QuietState {
  mode: TopLevelMode;
  reflectionDebt: number;
  missedReflectionCount: number;
  mustRunBy?: string;
}

export function runQuietPipeline(input: {
  quietState: QuietState;
  bundle: QuietInputBundle;
}): {
  shouldRunReflection: boolean;
  curation: MemoryCurationResult;
} {
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

  const sourceRefs = new Set<string>();
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
