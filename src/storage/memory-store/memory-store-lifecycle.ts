import { eq, desc } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { memoryStore } from "../db/schema/memory-store.js";
import type { MemoryStoreRow } from "../db/schema/memory-store.js";

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  snippet?: string;
}

export interface CanonicalMemoryEntry {
  entryId: string;
  kind: string;
  summary: string;
  sourceRefs: SourceRef[];
  createdAt: string;
}

export interface DreamInsight {
  id: string;
  type: "pattern" | "learning" | "observation" | "conflict";
  summary: string;
  sourceRefs: string[];
  confidence: number;
}

export interface MemoryStoreValidation {
  passed: boolean;
  summary: string;
  checkedAt: string;
  unsupportedClaims?: string[];
  redactionIssues?: string[];
}

export interface MemoryStore {
  memoryStoreId: string;
  lifecycleStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
  createdAt: string;
  inputMemoryStoreId?: string;
  dreamRunId?: string;
  canonicalEntries: CanonicalMemoryEntry[];
  insights: DreamInsight[];
  narrativeSnapshot?: Record<string, unknown>;
  relationshipSnapshot?: Record<string, unknown>;
  validation: MemoryStoreValidation;
}

export interface MemoryStoreWrite {
  memoryStoreId: string;
  lifecycleStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
  createdAt: string;
  inputMemoryStoreId?: string;
  dreamRunId?: string;
  canonicalEntries: CanonicalMemoryEntry[];
  insights: DreamInsight[];
  narrativeSnapshot?: Record<string, unknown>;
  relationshipSnapshot?: Record<string, unknown>;
  validation: MemoryStoreValidation;
}

export interface MemoryStoreLifecycleTransition {
  memoryStoreId: string;
  newStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
  validation?: MemoryStoreValidation;
  updatedAt: string;
}

export interface MemoryStoreAck {
  memoryStoreId: string;
  status: "acknowledged" | "degraded";
}

export interface MemoryStorePort {
  writeMemoryStore(output: MemoryStoreWrite): Promise<MemoryStoreAck>;
  loadMemoryStore(memoryStoreId: string): Promise<MemoryStore | null>;
  transitionMemoryStoreLifecycle(input: MemoryStoreLifecycleTransition): Promise<MemoryStoreAck>;
  loadAcceptedMemoryProjection(): Promise<MemoryStore | null>;
  listMemoryStoresByStatus(status: MemoryStore["lifecycleStatus"]): Promise<MemoryStore[]>;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToStore(row: MemoryStoreRow): MemoryStore {
  return {
    memoryStoreId: row.memoryStoreId,
    lifecycleStatus: row.lifecycleStatus as MemoryStore["lifecycleStatus"],
    createdAt: row.createdAt,
    inputMemoryStoreId: row.inputMemoryStoreId ?? undefined,
    dreamRunId: row.dreamRunId ?? undefined,
    canonicalEntries: safeParseJson<CanonicalMemoryEntry[]>(row.canonicalEntriesJson, []),
    insights: safeParseJson<DreamInsight[]>(row.insightsJson, []),
    narrativeSnapshot: row.narrativeSnapshotJson ? safeParseJson<Record<string, unknown> | undefined>(row.narrativeSnapshotJson, undefined) : undefined,
    relationshipSnapshot: row.relationshipSnapshotJson ? safeParseJson<Record<string, unknown> | undefined>(row.relationshipSnapshotJson, undefined) : undefined,
    validation: safeParseJson<MemoryStoreValidation>(row.validationJson, { passed: false, summary: "", checkedAt: "" }),
  };
}

export function createMemoryStoreLifecycle(database: StateDatabase): MemoryStorePort {
  const db = database.db;

  return {
    async writeMemoryStore(output: MemoryStoreWrite): Promise<MemoryStoreAck> {
      const existing = await db
        .select()
        .from(memoryStore)
        .where(eq(memoryStore.memoryStoreId, output.memoryStoreId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(memoryStore)
          .set({
            lifecycleStatus: output.lifecycleStatus,
            inputMemoryStoreId: output.inputMemoryStoreId ?? null,
            dreamRunId: output.dreamRunId ?? null,
            canonicalEntriesJson: JSON.stringify(output.canonicalEntries),
            insightsJson: JSON.stringify(output.insights),
            narrativeSnapshotJson: output.narrativeSnapshot ? JSON.stringify(output.narrativeSnapshot) : null,
            relationshipSnapshotJson: output.relationshipSnapshot ? JSON.stringify(output.relationshipSnapshot) : null,
            validationJson: JSON.stringify(output.validation),
          })
          .where(eq(memoryStore.memoryStoreId, output.memoryStoreId));
      } else {
        await db.insert(memoryStore).values({
          memoryStoreId: output.memoryStoreId,
          lifecycleStatus: output.lifecycleStatus,
          createdAt: output.createdAt,
          inputMemoryStoreId: output.inputMemoryStoreId ?? null,
          dreamRunId: output.dreamRunId ?? null,
          canonicalEntriesJson: JSON.stringify(output.canonicalEntries),
          insightsJson: JSON.stringify(output.insights),
          narrativeSnapshotJson: output.narrativeSnapshot ? JSON.stringify(output.narrativeSnapshot) : null,
          relationshipSnapshotJson: output.relationshipSnapshot ? JSON.stringify(output.relationshipSnapshot) : null,
          validationJson: JSON.stringify(output.validation),
        });
      }

      return { memoryStoreId: output.memoryStoreId, status: "acknowledged" };
    },

    async loadMemoryStore(memoryStoreId: string): Promise<MemoryStore | null> {
      const rows = await db
        .select()
        .from(memoryStore)
        .where(eq(memoryStore.memoryStoreId, memoryStoreId))
        .limit(1);

      if (rows.length === 0) return null;
      return rowToStore(rows[0]!);
    },

    async transitionMemoryStoreLifecycle(input: MemoryStoreLifecycleTransition): Promise<MemoryStoreAck> {
      const existing = await db
        .select()
        .from(memoryStore)
        .where(eq(memoryStore.memoryStoreId, input.memoryStoreId))
        .limit(1);

      if (existing.length === 0) {
        return { memoryStoreId: input.memoryStoreId, status: "degraded" };
      }

      const updates: Record<string, unknown> = { lifecycleStatus: input.newStatus };
      if (input.validation) {
        updates.validationJson = JSON.stringify(input.validation);
      }

      await db
        .update(memoryStore)
        .set(updates)
        .where(eq(memoryStore.memoryStoreId, input.memoryStoreId));

      return { memoryStoreId: input.memoryStoreId, status: "acknowledged" };
    },

    async loadAcceptedMemoryProjection(): Promise<MemoryStore | null> {
      const rows = await db
        .select()
        .from(memoryStore)
        .where(eq(memoryStore.lifecycleStatus, "accepted"))
        .orderBy(desc(memoryStore.createdAt))
        .limit(1);

      if (rows.length === 0) return null;
      return rowToStore(rows[0]!);
    },

    async listMemoryStoresByStatus(status: MemoryStore["lifecycleStatus"]): Promise<MemoryStore[]> {
      const rows = await db
        .select()
        .from(memoryStore)
        .where(eq(memoryStore.lifecycleStatus, status));

      return rows.map(rowToStore);
    },
  };
}
