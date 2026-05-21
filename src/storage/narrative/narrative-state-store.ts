import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { narrativeState } from "../db/schema/narrative-state.js";
import type { NarrativeStateRow } from "../db/schema/narrative-state.js";

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  snippet?: string;
}

export interface NarrativeState {
  narrativeId: string;
  revision: number;
  focus: string;
  progress: string[];
  nextIntent: string;
  confidence: number;
  sourceRefs: SourceRef[];
  unsupportedClaims: string[];
  status: "active" | "insufficient_sources" | "awaiting_sources";
  updatedAt: string;
}

export interface NarrativeStateUpdate {
  narrativeId: string;
  revision: number;
  focus: string;
  progress: string[];
  nextIntent: string;
  confidence: number;
  sourceRefs: SourceRef[];
  unsupportedClaims: string[];
  status: "active" | "insufficient_sources" | "awaiting_sources";
  updatedAt: string;
}

export interface NarrativeStateWriteAck {
  narrativeId: string;
  status: "acknowledged" | "degraded";
}

export interface NarrativeStateStore {
  updateNarrativeState(input: NarrativeStateUpdate): Promise<NarrativeStateWriteAck>;
  loadNarrativeState(narrativeId?: string): Promise<NarrativeState | null>;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToState(row: NarrativeStateRow): NarrativeState {
  return {
    narrativeId: row.narrativeId,
    revision: row.revision,
    focus: row.focus,
    progress: safeParseJson<string[]>(row.progressJson, []),
    nextIntent: row.nextIntent,
    confidence: row.confidence,
    sourceRefs: safeParseJson<SourceRef[]>(row.sourceRefsJson, []),
    unsupportedClaims: safeParseJson<string[]>(row.unsupportedClaimsJson, []),
    status: row.status as "active" | "insufficient_sources" | "awaiting_sources",
    updatedAt: row.updatedAt,
  };
}

const DEFAULT_NARRATIVE_ID = "default";

export function createNarrativeStateStore(database: StateDatabase): NarrativeStateStore {
  const db = database.db;

  return {
    async updateNarrativeState(input: NarrativeStateUpdate): Promise<NarrativeStateWriteAck> {
      const existing = await db
        .select()
        .from(narrativeState)
        .where(eq(narrativeState.narrativeId, input.narrativeId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(narrativeState)
          .set({
            revision: input.revision,
            focus: input.focus,
            progressJson: JSON.stringify(input.progress),
            nextIntent: input.nextIntent,
            confidence: input.confidence,
            sourceRefsJson: JSON.stringify(input.sourceRefs),
            unsupportedClaimsJson: JSON.stringify(input.unsupportedClaims),
            status: input.status,
            updatedAt: input.updatedAt,
          })
          .where(eq(narrativeState.narrativeId, input.narrativeId));
      } else {
        await db.insert(narrativeState).values({
          narrativeId: input.narrativeId,
          revision: input.revision,
          focus: input.focus,
          progressJson: JSON.stringify(input.progress),
          nextIntent: input.nextIntent,
          confidence: input.confidence,
          sourceRefsJson: JSON.stringify(input.sourceRefs),
          unsupportedClaimsJson: JSON.stringify(input.unsupportedClaims),
          status: input.status,
          updatedAt: input.updatedAt,
        });
      }

      return { narrativeId: input.narrativeId, status: "acknowledged" };
    },

    async loadNarrativeState(narrativeId?: string): Promise<NarrativeState | null> {
      const id = narrativeId ?? DEFAULT_NARRATIVE_ID;
      const rows = await db
        .select()
        .from(narrativeState)
        .where(eq(narrativeState.narrativeId, id))
        .limit(1);

      if (rows.length === 0) return null;
      return rowToState(rows[0]!);
    },
  };
}
