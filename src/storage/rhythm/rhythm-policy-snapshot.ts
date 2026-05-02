/**
 * Rhythm policy read model: state produces policy fields only (T4.1.2 owner boundary).
 *
 * Core logic: load workspace-scoped policy row or defaults; never emit control-plane decision fields.
 *
 * Test coverage: tests/unit/storage/rhythm-policy-snapshot.test.ts
 */
import * as crypto from "node:crypto";
import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { policyRecords } from "../db/schema/policies.js";

const WORKSPACE_SCOPE = "workspace";

export interface RhythmPolicySnapshot {
  snapshotId: string;
  generatedAt: string;
  quietEnabled: boolean;
  socialDailyLimit: number;
  outreachDailyBudget: number;
  updatedAt: string;
}

export async function loadRhythmPolicySnapshot(db: StateDatabase): Promise<RhythmPolicySnapshot> {
  const scoped = await db.db.select().from(policyRecords).where(eq(policyRecords.platformId, WORKSPACE_SCOPE)).limit(1);
  const row = scoped[0] ?? (await db.db.select().from(policyRecords).limit(1))[0];
  const generatedAt = new Date().toISOString();

  if (!row) {
    return {
      snapshotId: crypto.randomUUID(),
      generatedAt,
      quietEnabled: true,
      socialDailyLimit: 5,
      outreachDailyBudget: 2,
      updatedAt: generatedAt,
    };
  }

  return {
    snapshotId: crypto.randomUUID(),
    generatedAt,
    quietEnabled: row.quietEnabled,
    socialDailyLimit: row.socialDailyLimit,
    outreachDailyBudget: row.outreachDailyBudget ?? 2,
    updatedAt: row.updatedAt,
  };
}
