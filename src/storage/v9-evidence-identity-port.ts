/**
 * v9 Evidence Identity Port — Resolve stable evidence identity for attention-system.
 *
 * Core logic: Query the v8 evidence_item table (canonical identity owner in v9)
 * by platform + stable identity key, then map the row to StableEvidenceIdentity
 * with RepetitionKind. This port is read-only: it does not create evidence rows
 * and does not increment counters; normalization writes are owned by the v8
 * evidence ingestion path, which populates identity columns.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.md §4.2 §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §1.3 §3.1 §5.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §2`
 *
 * Dependencies:
 * - `src/storage/db/index.js` (StateDatabase)
 * - `src/storage/db/schema/v8-entities.js` (evidence_item)
 * - `src/shared/types/v9-contracts.js` (EvidenceItem, StableEvidenceIdentity)
 *
 * Boundary:
 * - Does not create evidence rows.
 * - Does not increment seenCount (write-side owner is evidence ingestion).
 * - Returns identity_unstable when source identity is unresolvable.
 *
 * Test coverage:
 * - tests/unit/attention/v9-attention-assembler.test.ts
 * - tests/integration/v9/stable-identity-attention.test.ts
 * - tests/integration/v9/repeated-feed-suppression.test.ts
 */

import { eq, and, desc } from "drizzle-orm";
import type { StateDatabase } from "./db/index.js";
import { evidenceItem } from "./db/schema/v8-entities.js";
import type {
  EvidenceItem,
  EvidenceIdentityPort,
  StableEvidenceIdentity,
  RepetitionKind,
  SourceRef,
} from "../shared/types/v9-contracts.js";

const EMPTY_CONTENT_HASH = "";

function stableIdentityKey(item: EvidenceItem): string {
  return item.externalId ?? item.contentHash ?? EMPTY_CONTENT_HASH;
}

function isUnstableItem(item: EvidenceItem): boolean {
  return !item.externalId && (!item.contentHash || item.contentHash === EMPTY_CONTENT_HASH);
}

function parseSourceRefs(json: string | null | undefined): SourceRef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as SourceRef[];
    return [];
  } catch {
    return [];
  }
}

async function findEvidenceRow(
  db: StateDatabase,
  item: EvidenceItem,
): Promise<typeof evidenceItem.$inferSelect | undefined> {
  const key = stableIdentityKey(item);
  const platformId = item.platformId;

  // Primary lookup by stable identity key (populated by v8 ingestion).
  if (key !== EMPTY_CONTENT_HASH) {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(and(eq(evidenceItem.platformId, platformId), eq(evidenceItem.stableIdentityKey, key)))
      .orderBy(desc(evidenceItem.lastObservedAt), desc(evidenceItem.createdAt))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  // Fallback for legacy rows with empty stableIdentityKey.
  if (item.contentHash) {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(and(eq(evidenceItem.platformId, platformId), eq(evidenceItem.contentHash, item.contentHash)))
      .orderBy(desc(evidenceItem.lastObservedAt), desc(evidenceItem.createdAt))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  if (item.externalId) {
    const rows = await db.db
      .select()
      .from(evidenceItem)
      .where(and(eq(evidenceItem.platformId, platformId), eq(evidenceItem.externalId, item.externalId)))
      .orderBy(desc(evidenceItem.lastObservedAt), desc(evidenceItem.createdAt))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  return undefined;
}

function resolveRepetition(
  item: EvidenceItem,
  row: typeof evidenceItem.$inferSelect | undefined,
): RepetitionKind {
  if (isUnstableItem(item)) return "identity_unstable";
  if (!row) return "identity_unstable";
  if (!row.contentHash) return "identity_unstable";
  if (row.seenCount <= 1) return "new";
  // row.contentHash is the first observed hash; current item.contentHash may differ.
  if (item.contentHash && item.contentHash !== row.contentHash) return "changed";
  return "duplicate";
}

function buildStableIdentity(
  item: EvidenceItem,
  row: typeof evidenceItem.$inferSelect | undefined,
): StableEvidenceIdentity {
  const repetitionStatus = resolveRepetition(item, row);
  const now = item.observedAt;

  if (repetitionStatus === "identity_unstable" || !row) {
    return {
      logicalId: `unstable-${item.platformId}-${now}`,
      platformId: item.platformId,
      externalId: item.externalId,
      contentHash: item.contentHash ?? EMPTY_CONTENT_HASH,
      seenCount: 0,
      firstObservedAt: now,
      lastObservedAt: now,
      repetitionStatus: "identity_unstable",
    };
  }

  return {
    logicalId: row.id,
    platformId: row.platformId,
    externalId: row.externalId ?? undefined,
    contentHash: row.contentHash ?? EMPTY_CONTENT_HASH,
    seenCount: row.seenCount ?? 1,
    firstObservedAt: row.firstObservedAt ?? row.createdAt ?? now,
    lastObservedAt: row.lastObservedAt ?? row.observedAt ?? now,
    repetitionStatus,
  };
}

export const createEvidenceIdentityPort = (db: StateDatabase): EvidenceIdentityPort => ({
  async normalizeEvidenceIdentity(item: EvidenceItem): Promise<StableEvidenceIdentity> {
    if (isUnstableItem(item)) {
      return buildStableIdentity(item, undefined);
    }
    const row = await findEvidenceRow(db, item);
    return buildStableIdentity(item, row);
  },
});

export type { EvidenceItem, StableEvidenceIdentity, EvidenceIdentityPort };
