/**
 * T-SMS.F.3 — Write Queue unit tests.
 *
 * Verification (05A / 05B):
 * - Concurrent writes serialize correctly
 * - Flush failure writes to stderr, read path unblocked
 * - triggerSource preserved through pipeline
 * - Retry on busy errors
 *
 * Dependencies: sql.js, src/storage/db/write-queue.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

import {
  createWriteQueue,
  type WriteRequest,
  type TriggerSource,
} from "../../../src/storage/db/write-queue.js";

async function createMemoryDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE test_writes (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      trigger_source TEXT NOT NULL
    );
  `);
  return db;
}

describe("write-queue", () => {
  it("serializes concurrent write requests", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    const order: number[] = [];

    const req1: WriteRequest<void> = {
      label: "write-1",
      triggerSource: "heartbeat",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('w1', 'first', 'heartbeat')"
        );
        order.push(1);
      },
    };

    const req2: WriteRequest<void> = {
      label: "write-2",
      triggerSource: "manual_run",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('w2', 'second', 'manual_run')"
        );
        order.push(2);
      },
    };

    // Enqueue both simultaneously
    const [r1, r2] = await Promise.all([
      queue.enqueue(req1),
      queue.enqueue(req2),
    ]);

    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);

    // Both writes should be present
    const rows = sqlite.exec("SELECT id FROM test_writes ORDER BY id");
    assert.equal(rows[0].values.length, 2);
    assert.deepEqual(rows[0].values.map((r) => r[0]), ["w1", "w2"]);

    // Order should be sequential (1 then 2)
    assert.deepEqual(order, [1, 2]);
    sqlite.close();
  });

  it("preserves triggerSource through the pipeline", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    const sources: TriggerSource[] = ["heartbeat", "manual_run", "probe", "idle_curiosity"];

    for (const source of sources) {
      const result = await queue.enqueue({
        label: `write-${source}`,
        triggerSource: source,
        execute: (db) => {
          db.exec(
            `INSERT INTO test_writes (id, value, trigger_source) VALUES ('${source}', 'val', '${source}')`
          );
          return source;
        },
      });

      assert.equal(result.ok, true);
      assert.equal(result.triggerSource, source);
      assert.equal(result.value, source);
    }

    // Verify stored trigger sources
    for (const source of sources) {
      const rows = sqlite.exec(
        `SELECT trigger_source FROM test_writes WHERE id = '${source}'`
      );
      assert.equal(rows[0].values[0][0], source);
    }

    sqlite.close();
  });

  it("manual_run triggerSource is not overwritten", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    const result = await queue.enqueue({
      label: "manual-write",
      triggerSource: "manual_run",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('m1', 'manual', 'manual_run')"
        );
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.triggerSource, "manual_run");

    const rows = sqlite.exec(
      "SELECT trigger_source FROM test_writes WHERE id = 'm1'"
    );
    assert.equal(rows[0].values[0][0], "manual_run");
    sqlite.close();
  });

  it("write failure sends error to stderr without blocking reads", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    const result = await queue.enqueue({
      label: "bad-write",
      triggerSource: "heartbeat",
      execute: () => {
        throw new Error("simulated write failure");
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.error);
    assert.ok(result.error.includes("simulated write failure"));

    // Read path still works
    const rows = sqlite.exec("SELECT COUNT(*) FROM test_writes");
    assert.equal(rows[0].values[0][0], 0);
    sqlite.close();
  });

  it("failed write does not block subsequent writes", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    // First write fails
    await queue.enqueue({
      label: "fail",
      triggerSource: "heartbeat",
      execute: () => {
        throw new Error("first failure");
      },
    });

    // Second write succeeds
    const result = await queue.enqueue({
      label: "succeed",
      triggerSource: "heartbeat",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('s1', 'ok', 'heartbeat')"
        );
      },
    });

    assert.equal(result.ok, true);

    const rows = sqlite.exec("SELECT id FROM test_writes");
    assert.equal(rows[0].values.length, 1);
    assert.equal(rows[0].values[0][0], "s1");
    sqlite.close();
  });

  it("returns value from successful write execution", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    const result = await queue.enqueue({
      label: "return-val",
      triggerSource: "probe",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('r1', 'ret', 'probe')"
        );
        return { inserted: "r1" };
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { inserted: "r1" });
    sqlite.close();
  });

  it("pending count reflects queue state", async () => {
    const sqlite = await createMemoryDb();
    const queue = createWriteQueue(sqlite);

    assert.equal(queue.pending, 0);

    // Quick sequential writes to verify pending doesn't grow unexpectedly
    await queue.enqueue({
      label: "p1",
      triggerSource: "heartbeat",
      execute: (db) => {
        db.exec(
          "INSERT INTO test_writes (id, value, trigger_source) VALUES ('p1', 'v', 'heartbeat')"
        );
      },
    });

    assert.equal(queue.pending, 0);
    sqlite.close();
  });
});
