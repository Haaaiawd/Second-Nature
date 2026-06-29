/**
 * v9 AutonomousChangeLedger — Unit Tests
 *
 * Validates: canonical entry write, sourceRefs required, query by target/status,
 * activate/rollBack lifecycle, redacted read model.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { AutonomousChangeLedgerService } from "../../../src/observability/services/autonomous-change-ledger.js";
import type { AutonomousChangeLedgerEntry, AutonomousChangeKind, SourceRef } from "../../../src/shared/types/v9-contracts.js";

const now = "2026-06-26T00:00:00Z";

function makeSourceRef(overrides?: Partial<SourceRef>): SourceRef {
  return { family: "routine", id: "routine-1", ...overrides };
}

function makeEntry(
  overrides?: Partial<Omit<AutonomousChangeLedgerEntry, "id" | "createdAt">>,
): Omit<AutonomousChangeLedgerEntry, "id" | "createdAt"> {
  return {
    workspaceRoot: "/workspace",
    changeKind: "routine_install",
    targetId: "routine-1",
    sourceRefs: [makeSourceRef()],
    status: "proposed",
    ...overrides,
  };
}

describe("v9-autonomous-change-ledger-service", () => {
  it("writeLedgerEntry preserves caller-provided id and createdAt", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    const entry: AutonomousChangeLedgerEntry = {
      id: "ledger-caller-id",
      workspaceRoot: "/workspace",
      changeKind: "routine_install" as AutonomousChangeKind,
      targetId: "routine-preserved",
      sourceRefs: [makeSourceRef()],
      status: "proposed",
      createdAt: "2026-01-01T00:00:00Z",
    };

    await service.writeLedgerEntry(entry);
    const read = await service.readById("ledger-caller-id");
    assert.ok(read);
    assert.equal(read?.id, "ledger-caller-id");
    assert.equal(read?.createdAt, "2026-01-01T00:00:00Z");
  });

  it("returns degraded when state database is closed", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);
    await service.write(makeEntry({ targetId: "t-degraded" }));
    db.close();

    const result = await service.readByStatus("proposed");
    assert.equal(result.entries.length, 0);
    assert.ok(result.degraded);
    assert.equal(result.degraded?.reason, "state_unreadable");
  });

  it("writes canonical entry and reads it back", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    const written = await service.write(makeEntry({ rollbackCommandHint: "sn rollback routine routine-1" }));

    const read = await service.readById(written.id);
    assert.ok(read);
    assert.equal(read?.changeKind, "routine_install");
    assert.equal(read?.targetId, "routine-1");
    assert.equal(read?.status, "proposed");
    assert.equal(read?.rollbackCommandHint, "sn rollback routine routine-1");
    assert.equal(read?.sourceRefs.length, 1);
    assert.equal(read?.sourceRefs[0]?.family, "routine");
  });

  it("rejects entry without sourceRefs", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    await assert.rejects(
      () =>
        service.write({
          workspaceRoot: "/workspace",
          changeKind: "routine_install",
          targetId: "routine-1",
          sourceRefs: [],
          status: "proposed",
        }),
      /sourceRefs required/,
    );
  });

  it("queries by target", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    await service.write(makeEntry({ targetId: "target-a" }));
    await service.write(makeEntry({ targetId: "target-a", changeKind: "routine_supersede" }));
    await service.write(makeEntry({ targetId: "target-b" }));

    const { entries } = await service.readByTarget("target-a");
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.targetId === "target-a"));
  });

  it("queries by status", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    const e1 = await service.write(makeEntry({ targetId: "t1" }));
    const e2 = await service.write(makeEntry({ targetId: "t2" }));
    await service.activate(e1.id);

    const { entries } = await service.readByStatus("activated");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.id, e1.id);
    assert.equal(entries[0]?.status, "activated");
    assert.ok(entries[0]?.activatedAt);
  });

  it("redacted read model omits gateResultsJson", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    await service.write(
      makeEntry({
        targetId: "t-redact",
        gateResultsJson: JSON.stringify([{ gate: "schema", passed: true }]),
        redactedPayloadJson: JSON.stringify({ summary: "installed routine" }),
      }),
    );

    const redacted = await service.readRedactedByTarget("t-redact");
    assert.equal(redacted.length, 1);
    assert.equal((redacted[0] as any).gateResultsJson, undefined);
    assert.ok(redacted[0]?.redactedPayloadJson);
  });

  it("rolls back an entry", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    const entry = await service.write(makeEntry());
    await service.rollBack(entry.id, { rollbackRef: "git:abc123" });

    const read = await service.readById(entry.id);
    assert.equal(read?.status, "rolled_back");
    assert.equal(read?.rollbackRef, "git:abc123");
    assert.ok(read?.rolledBackAt);
  });

  it("gates an entry with gate results", async () => {
    const db = createStateDatabase(":memory:");
    const service = new AutonomousChangeLedgerService(db);

    const entry = await service.write(makeEntry());
    await service.gate(entry.id, JSON.stringify([{ gate: "permission", passed: false, reason: "owner denied" }]));

    const read = await service.readById(entry.id);
    assert.equal(read?.status, "gated");
    assert.ok(read?.gateResultsJson?.includes("owner denied"));
  });
});
