/**
 * Content-bearing evidence fixture helper.
 *
 * Use this to seed evidence that survives the T-DQ.R.9 Quiet placeholder
 * rejection rule. Closure-only or id-only evidence is correctly rejected as
 * non-content; tests that intend a full Quiet → Dream completion must provide
 * content-bearing evidence or perception.
 */

import { createStateDatabase } from "../../src/storage/db/index.js";
import { writeEvidenceItem } from "../../src/storage/v8-state-stores.js";
import type { SourceRef } from "../../src/shared/types/v8-contracts.js";

export type StateDatabase = ReturnType<typeof createStateDatabase>;

export function contentEvidencePayload(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    contentStatus: "content_present",
    title: "Real content signal",
    summary: "This evidence carries enough content to avoid Quiet placeholder rejection.",
    ...overrides,
  };
}

export interface SeedContentEvidenceOptions {
  id?: string;
  platformId?: string;
  contentHash?: string;
  now?: string;
  payload?: Record<string, unknown>;
  sourceRefs?: SourceRef[];
}

export async function seedContentEvidence(
  db: StateDatabase,
  options: SeedContentEvidenceOptions = {},
): Promise<{ id: string }> {
  const now = options.now ?? new Date().toISOString();
  const id = options.id ?? `ev_content_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const platformId = options.platformId ?? "moltbook";
  const contentHash = options.contentHash ?? `hash_${id}`;
  const sourceRefs: SourceRef[] = options.sourceRefs ?? [
    {
      uri: `sn://evidence/${id}`,
      family: "evidence",
      id,
      redactionClass: "none",
      resolveStatus: "resolvable",
    },
  ];

  const result = await writeEvidenceItem(db, {
    id,
    createdAt: now,
    platformId,
    contentHash,
    observedAt: now,
    sourceRefs,
    redactionClass: "none",
    lifecycleStatus: "pending",
    payloadJson: JSON.stringify(contentEvidencePayload(options.payload)),
  });

  if ("reason" in result) {
    throw new Error(`seedContentEvidence failed: ${result.reason}`);
  }

  return result;
}
