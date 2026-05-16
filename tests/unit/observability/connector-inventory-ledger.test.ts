/**
 * Unit coverage for `ConnectorInventoryLedger` (T5.1.3).
 *
 * Verifies recordAudit round-trip, getLatestAudit by snapshotId,
 * listAudits pagination, and JSON field deserialization.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { ConnectorInventoryLedger } from "../../../src/observability/connector-inventory-ledger.js";
import { connectorInventoryAudit } from "../../../src/observability/db/schema/index.js";

test("T5.1.3 recordAudit writes a row and returns auditId", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  const auditId = await ledger.recordAudit({
    snapshotId: "snap-001",
    scanned: 5,
    registered: 3,
    skipped: 2,
    conflicts: [{ connectorId: "evomap", reason: "duplicate_capability" }],
    validationErrors: [],
    trustSummary: { declarative_trusted: 2, custom_adapter_pending_trust: 1 },
  });

  assert.ok(auditId.length > 0, "auditId should be non-empty");

  const rows = await db.db.select().from(connectorInventoryAudit).execute();
  assert.equal(rows.length, 1);
  const row = rows[0] as Record<string, unknown>;
  assert.equal(row.snapshotId, "snap-001");
  assert.equal(row.scanned, 5);
  assert.equal(row.registered, 3);
  assert.equal(row.skipped, 2);

  db.close();
});

test("T5.1.3 getLatestAudit returns the most recent audit for a snapshotId", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  await ledger.recordAudit({
    snapshotId: "snap-a",
    scanned: 1,
    registered: 1,
    skipped: 0,
  });
  await new Promise((r) => setTimeout(r, 20));
  await ledger.recordAudit({
    snapshotId: "snap-a",
    scanned: 2,
    registered: 2,
    skipped: 0,
  });

  const latest = await ledger.getLatestAudit("snap-a");
  assert.ok(latest);
  assert.equal(latest!.scanned, 2);
  assert.equal(latest!.registered, 2);

  db.close();
});

test("T5.1.3 getLatestAudit returns undefined when snapshotId absent", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  const latest = await ledger.getLatestAudit("nonexistent");
  assert.equal(latest, undefined);

  db.close();
});

test("T5.1.3 listAudits respects limit and offset", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  for (let i = 0; i < 5; i++) {
    await ledger.recordAudit({
      snapshotId: `snap-${i}`,
      scanned: i,
      registered: i,
      skipped: 0,
    });
  }

  const all = await ledger.listAudits();
  assert.equal(all.length, 5);

  const limited = await ledger.listAudits({ limit: 2 });
  assert.equal(limited.length, 2);

  const offset = await ledger.listAudits({ limit: 2, offset: 2 });
  assert.equal(offset.length, 2);

  db.close();
});

test("T5.1.3 JSON fields deserialize correctly", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  const auditId = await ledger.recordAudit({
    snapshotId: "snap-json",
    scanned: 3,
    registered: 2,
    skipped: 1,
    conflicts: [
      { connectorId: "moltbook", reason: "capability_collision" },
    ],
    validationErrors: [
      { connectorId: "instreet", errors: ["missing_entrypoint"] },
    ],
    trustSummary: { declarative_trusted: 1, blocked: 1 },
  });

  const snapshot = await ledger.getLatestAudit("snap-json");
  assert.ok(snapshot);
  assert.equal(snapshot!.auditId, auditId);
  assert.deepEqual(snapshot!.conflicts, [
    { connectorId: "moltbook", reason: "capability_collision" },
  ]);
  assert.deepEqual(snapshot!.validationErrors, [
    { connectorId: "instreet", errors: ["missing_entrypoint"] },
  ]);
  assert.deepEqual(snapshot!.trustSummary, {
    declarative_trusted: 1,
    blocked: 1,
  });

  db.close();
});

test("T5.1.3 defaults for optional fields are empty arrays/objects", async () => {
  const db = createObservabilityDatabase(":memory:");
  const ledger = new ConnectorInventoryLedger(db);

  await ledger.recordAudit({
    snapshotId: "snap-defaults",
    scanned: 1,
    registered: 1,
    skipped: 0,
  });

  const snapshot = await ledger.getLatestAudit("snap-defaults");
  assert.ok(snapshot);
  assert.deepEqual(snapshot!.conflicts, []);
  assert.deepEqual(snapshot!.validationErrors, []);
  assert.deepEqual(snapshot!.trustSummary, {});

  db.close();
});
