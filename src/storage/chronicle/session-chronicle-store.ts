import { eq, gte, lte, inArray, desc, and } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { sessionChronicle } from "../db/schema/session-chronicle.js";
import type { SessionChronicleRow } from "../db/schema/session-chronicle.js";

export type ChronicleEventKind =
  | "heartbeat"
  | "connector_action"
  | "outreach"
  | "owner_reply"
  | "dream_run"
  | "maintenance";

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  snippet?: string;
}

export interface OwnerReplySignal {
  tone?: string;
  delayMinutes?: number;
  topics?: string[];
  explicitPreference?: string;
}

export interface SessionChronicleEntry {
  entryId: string;
  eventKind: ChronicleEventKind;
  actor: "agent" | "owner" | "system";
  occurredAt: string;
  summary: string;
  result: "succeeded" | "failed" | "skipped" | "no_reply" | "partial";
  sourceRefs: SourceRef[];
  relatedDecisionId?: string;
  relatedDreamRunId?: string;
  ownerReply?: OwnerReplySignal;
}

export interface ChronicleQuery {
  eventKinds?: ChronicleEventKind[];
  from?: string; // ISO date
  to?: string; // ISO date
  actor?: "agent" | "owner" | "system";
  limit?: number;
}

export interface ChronicleWriteAck {
  entryId: string;
  status: "acknowledged" | "degraded";
}

function rowToEntry(row: SessionChronicleRow): SessionChronicleEntry {
  return {
    entryId: row.entryId,
    eventKind: row.eventKind as ChronicleEventKind,
    actor: row.actor as "agent" | "owner" | "system",
    occurredAt: row.occurredAt,
    summary: row.summary,
    result: row.result as "succeeded" | "failed" | "skipped" | "no_reply" | "partial",
    sourceRefs: safeParseJson<SourceRef[]>(row.sourceRefsJson, []),
    relatedDecisionId: row.relatedDecisionId ?? undefined,
    relatedDreamRunId: row.relatedDreamRunId ?? undefined,
    ownerReply: row.ownerReplyJson ? safeParseJson<OwnerReplySignal | undefined>(row.ownerReplyJson, undefined) : undefined,
  };
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export interface SessionChronicleStore {
  appendSessionChronicle(entry: SessionChronicleEntry): Promise<ChronicleWriteAck>;
  loadSessionChronicle(query: ChronicleQuery): Promise<SessionChronicleEntry[]>;
}

export function createSessionChronicleStore(database: StateDatabase): SessionChronicleStore {
  const db = database.db;

  return {
    async appendSessionChronicle(entry: SessionChronicleEntry): Promise<ChronicleWriteAck> {
      await db.insert(sessionChronicle).values({
        entryId: entry.entryId,
        eventKind: entry.eventKind,
        actor: entry.actor,
        occurredAt: entry.occurredAt,
        summary: entry.summary,
        result: entry.result,
        sourceRefsJson: JSON.stringify(entry.sourceRefs),
        relatedDecisionId: entry.relatedDecisionId ?? null,
        relatedDreamRunId: entry.relatedDreamRunId ?? null,
        ownerReplyJson: entry.ownerReply ? JSON.stringify(entry.ownerReply) : null,
      });
      return { entryId: entry.entryId, status: "acknowledged" };
    },

    async loadSessionChronicle(query: ChronicleQuery): Promise<SessionChronicleEntry[]> {
      const conditions = [];

      if (query.eventKinds && query.eventKinds.length > 0) {
        conditions.push(inArray(sessionChronicle.eventKind, query.eventKinds));
      }
      if (query.from) {
        conditions.push(gte(sessionChronicle.occurredAt, query.from));
      }
      if (query.to) {
        conditions.push(lte(sessionChronicle.occurredAt, query.to));
      }
      if (query.actor) {
        conditions.push(eq(sessionChronicle.actor, query.actor));
      }

      const rows = await db
        .select()
        .from(sessionChronicle)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sessionChronicle.occurredAt))
        .limit(query.limit ?? 100);

      return rows.map(rowToEntry);
    },
  };
}
