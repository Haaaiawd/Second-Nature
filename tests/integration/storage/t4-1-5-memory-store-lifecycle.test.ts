import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createMemoryStoreLifecycle,
  type MemoryStoreWrite,
  type MemoryStoreLifecycleTransition,
} from "../../../src/storage/memory-store/memory-store-lifecycle.js";

function makeWrite(overrides: Partial<MemoryStoreWrite> = {}): MemoryStoreWrite {
  return {
    memoryStoreId: `ms-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lifecycleStatus: "candidate",
    createdAt: new Date().toISOString(),
    inputMemoryStoreId: "input-1",
    dreamRunId: "dream-1",
    canonicalEntries: [{ entryId: "e1", kind: "insight", summary: "test", sourceRefs: [], createdAt: new Date().toISOString() }],
    insights: [{ id: "i1", type: "pattern", summary: "pattern A", sourceRefs: ["s1"], confidence: 0.8 }],
    validation: { passed: true, summary: "ok", checkedAt: new Date().toISOString() },
    ...overrides,
  };
}

test("writeMemoryStore writes candidate and load returns it", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const write = makeWrite();
  const ack = await port.writeMemoryStore(write);
  assert.equal(ack.memoryStoreId, write.memoryStoreId);
  assert.equal(ack.status, "acknowledged");

  const loaded = await port.loadMemoryStore(write.memoryStoreId);
  assert.ok(loaded);
  assert.equal(loaded!.lifecycleStatus, "candidate");
  assert.equal(loaded!.inputMemoryStoreId, "input-1");
  assert.equal(loaded!.canonicalEntries.length, 1);
});

test("transitionMemoryStoreLifecycle candidate -> accepted updates active pointer", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const write = makeWrite();
  await port.writeMemoryStore(write);

  const transition: MemoryStoreLifecycleTransition = {
    memoryStoreId: write.memoryStoreId,
    newStatus: "accepted",
    updatedAt: new Date().toISOString(),
  };
  const ack = await port.transitionMemoryStoreLifecycle(transition);
  assert.equal(ack.status, "acknowledged");

  const loaded = await port.loadMemoryStore(write.memoryStoreId);
  assert.equal(loaded!.lifecycleStatus, "accepted");

  const projection = await port.loadAcceptedMemoryProjection();
  assert.ok(projection);
  assert.equal(projection!.memoryStoreId, write.memoryStoreId);
});

test("transitionMemoryStoreLifecycle candidate -> archived on validation failure", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const write = makeWrite();
  await port.writeMemoryStore(write);

  await port.transitionMemoryStoreLifecycle({
    memoryStoreId: write.memoryStoreId,
    newStatus: "archived",
    validation: { passed: false, summary: "unsupported claims detected", checkedAt: new Date().toISOString(), unsupportedClaims: ["bad claim"] },
    updatedAt: new Date().toISOString(),
  });

  const loaded = await port.loadMemoryStore(write.memoryStoreId);
  assert.equal(loaded!.lifecycleStatus, "archived");

  const projection = await port.loadAcceptedMemoryProjection();
  assert.equal(projection, null);
});

test("loadAcceptedMemoryProjection only reads accepted stores", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const candidate = makeWrite({ memoryStoreId: "c1" });
  const accepted = makeWrite({ memoryStoreId: "a1", lifecycleStatus: "accepted" });
  await port.writeMemoryStore(candidate);
  await port.writeMemoryStore(accepted);

  const projection = await port.loadAcceptedMemoryProjection();
  assert.ok(projection);
  assert.equal(projection!.memoryStoreId, "a1");
});

test("inputMemoryStoreId remains unchanged after write", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const write = makeWrite({ inputMemoryStoreId: "immutable-input" });
  await port.writeMemoryStore(write);

  const loaded = await port.loadMemoryStore(write.memoryStoreId);
  assert.equal(loaded!.inputMemoryStoreId, "immutable-input");
});

test("listMemoryStoresByStatus filters correctly", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  await port.writeMemoryStore(makeWrite({ memoryStoreId: "c1" }));
  await port.writeMemoryStore(makeWrite({ memoryStoreId: "c2" }));
  await port.writeMemoryStore(makeWrite({ memoryStoreId: "a1", lifecycleStatus: "accepted" }));

  const candidates = await port.listMemoryStoresByStatus("candidate");
  assert.equal(candidates.length, 2);

  const accepted = await port.listMemoryStoresByStatus("accepted");
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]!.memoryStoreId, "a1");
});

test("transition on missing store returns degraded", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const ack = await port.transitionMemoryStoreLifecycle({
    memoryStoreId: "missing",
    newStatus: "accepted",
    updatedAt: new Date().toISOString(),
  });
  assert.equal(ack.status, "degraded");
});

test("writeMemoryStore update replaces existing candidate", async () => {
  const db = createStateDatabase(":memory:");
  const port = createMemoryStoreLifecycle(db);

  const write = makeWrite({ canonicalEntries: [{ entryId: "e1", kind: "insight", summary: "first", sourceRefs: [], createdAt: "" }] });
  await port.writeMemoryStore(write);
  await port.writeMemoryStore({
    ...write,
    canonicalEntries: [{ entryId: "e2", kind: "insight", summary: "second", sourceRefs: [], createdAt: "" }],
  });

  const loaded = await port.loadMemoryStore(write.memoryStoreId);
  assert.equal(loaded!.canonicalEntries.length, 1);
  assert.equal(loaded!.canonicalEntries[0]!.summary, "second");
});
