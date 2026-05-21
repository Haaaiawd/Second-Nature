/**
 * P2-06 — Observability retention cleanup.
 *
 * Verifies that `pruneObservabilityTables` deletes rows older than a
 * threshold while leaving newer rows intact.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import {
  decisionLedger,
  executionAttempts,
} from "../../../src/observability/db/schema/index.js";
import { pruneObservabilityTables } from "../../../src/observability/services/observability-retention.js";

async function seedDecisionLedger(
  db: ReturnType<typeof createObservabilityDatabase>,
) {
  await db.db.insert(decisionLedger).values([
    {
      id: "dl-old",
      tickId: "t1",
      traceId: "tr-old",
      verdict: "denied",
      mode: "active",
      reasons: "[]",
      reasonCodes: "[]",
      decisionBasis: "rule_only",
      evidenceRefs: "[]",
      createdAt: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "dl-new",
      tickId: "t2",
      traceId: "tr-new",
      verdict: "denied",
      mode: "active",
      reasons: "[]",
      reasonCodes: "[]",
      decisionBasis: "rule_only",
      evidenceRefs: "[]",
      createdAt: "2026-05-11T00:00:00.000Z",
    },
  ]);
}

async function seedExecutionAttempts(
  db: ReturnType<typeof createObservabilityDatabase>,
) {
  await db.db.insert(executionAttempts).values([
    {
      id: "ea-old",
      traceId: "tr-old",
      decisionId: "d1",
      intentId: "i1",
      platformId: "p1",
      capability: "cap",
      channel: "ch",
      status: "failed",
      startedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "ea-new",
      traceId: "tr-new",
      decisionId: "d2",
      intentId: "i2",
      platformId: "p2",
      capability: "cap",
      channel: "ch",
      status: "succeeded",
      startedAt: "2026-05-11T00:00:00.000Z",
    },
  ]);
}

test("P2-06: prune deletes old rows and preserves new ones", async () => {
  const db = createObservabilityDatabase(":memory:");
  await seedDecisionLedger(db);
  await seedExecutionAttempts(db);

  const result = await pruneObservabilityTables(db, {
    beforeDate: "2026-05-10T00:00:00.000Z",
  });

  assert.equal(
    result.decisionLedgerDeleted,
    1,
    "one old decision ledger row deleted",
  );
  assert.equal(
    result.executionAttemptsDeleted,
    1,
    "one old execution attempt row deleted",
  );

  const remainingDL = await db.db.select().from(decisionLedger);
  const remainingEA = await db.db.select().from(executionAttempts);

  assert.equal(remainingDL.length, 1, "one decision ledger row remains");
  assert.equal(remainingDL[0]!.id, "dl-new", "remaining row is the new one");

  assert.equal(remainingEA.length, 1, "one execution attempt row remains");
  assert.equal(remainingEA[0]!.id, "ea-new", "remaining row is the new one");

  db.close();
});

test("P2-06: prune with past date deletes nothing", async () => {
  const db = createObservabilityDatabase(":memory:");
  await seedDecisionLedger(db);
  await seedExecutionAttempts(db);

  // All seeded rows are on 2026-05-01 or 2026-05-11; pruning before 2026-01-01 should match nothing.
  const result = await pruneObservabilityTables(db, {
    beforeDate: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.decisionLedgerDeleted, 0);
  assert.equal(result.executionAttemptsDeleted, 0);

  db.close();
});
