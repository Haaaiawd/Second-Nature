import { eq } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { relationshipMemory } from "../db/schema/relationship-memory.js";
import type { RelationshipMemoryRow } from "../db/schema/relationship-memory.js";

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  snippet?: string;
}

export interface TopicAffinity {
  topic: string;
  affinity: number;
}

export interface RelationshipMemory {
  relationshipId: string;
  revision: number;
  tonePreference: "casual" | "direct" | "quiet" | "unknown";
  averageReplyDelayMinutes?: number;
  noReplyCount: number;
  topicAffinities: TopicAffinity[];
  lastInteractionAt?: string;
  sourceRefs: SourceRef[];
  updatedAt: string;
}

export interface RelationshipMemoryUpdate {
  relationshipId: string;
  revision: number;
  tonePreference: "casual" | "direct" | "quiet" | "unknown";
  averageReplyDelayMinutes?: number;
  noReplyCount: number;
  topicAffinities: TopicAffinity[];
  lastInteractionAt?: string;
  sourceRefs: SourceRef[];
  updatedAt: string;
}

export interface RelationshipMemoryWriteAck {
  relationshipId: string;
  status: "acknowledged" | "degraded";
}

export interface RelationshipMemoryStore {
  upsertRelationshipMemory(input: RelationshipMemoryUpdate): Promise<RelationshipMemoryWriteAck>;
  loadRelationshipMemory(relationshipId?: string): Promise<RelationshipMemory | null>;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToMemory(row: RelationshipMemoryRow): RelationshipMemory {
  return {
    relationshipId: row.relationshipId,
    revision: row.revision,
    tonePreference: row.tonePreference as "casual" | "direct" | "quiet" | "unknown",
    averageReplyDelayMinutes: row.averageReplyDelayMinutes ?? undefined,
    noReplyCount: row.noReplyCount,
    topicAffinities: safeParseJson<TopicAffinity[]>(row.topicAffinitiesJson, []),
    lastInteractionAt: row.lastInteractionAt ?? undefined,
    sourceRefs: safeParseJson<SourceRef[]>(row.sourceRefsJson, []),
    updatedAt: row.updatedAt,
  };
}

const DEFAULT_RELATIONSHIP_ID = "default";

export function createRelationshipMemoryStore(database: StateDatabase): RelationshipMemoryStore {
  const db = database.db;

  return {
    async upsertRelationshipMemory(input: RelationshipMemoryUpdate): Promise<RelationshipMemoryWriteAck> {
      const existing = await db
        .select()
        .from(relationshipMemory)
        .where(eq(relationshipMemory.relationshipId, input.relationshipId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(relationshipMemory)
          .set({
            revision: input.revision,
            tonePreference: input.tonePreference,
            averageReplyDelayMinutes: input.averageReplyDelayMinutes ?? null,
            noReplyCount: input.noReplyCount,
            topicAffinitiesJson: JSON.stringify(input.topicAffinities),
            lastInteractionAt: input.lastInteractionAt ?? null,
            sourceRefsJson: JSON.stringify(input.sourceRefs),
            updatedAt: input.updatedAt,
          })
          .where(eq(relationshipMemory.relationshipId, input.relationshipId));
      } else {
        await db.insert(relationshipMemory).values({
          relationshipId: input.relationshipId,
          revision: input.revision,
          tonePreference: input.tonePreference,
          averageReplyDelayMinutes: input.averageReplyDelayMinutes ?? null,
          noReplyCount: input.noReplyCount,
          topicAffinitiesJson: JSON.stringify(input.topicAffinities),
          lastInteractionAt: input.lastInteractionAt ?? null,
          sourceRefsJson: JSON.stringify(input.sourceRefs),
          updatedAt: input.updatedAt,
        });
      }

      return { relationshipId: input.relationshipId, status: "acknowledged" };
    },

    async loadRelationshipMemory(relationshipId?: string): Promise<RelationshipMemory | null> {
      const id = relationshipId ?? DEFAULT_RELATIONSHIP_ID;
      const rows = await db
        .select()
        .from(relationshipMemory)
        .where(eq(relationshipMemory.relationshipId, id))
        .limit(1);

      if (rows.length === 0) return null;
      return rowToMemory(rows[0]!);
    },
  };
}
