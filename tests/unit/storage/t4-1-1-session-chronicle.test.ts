import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createSessionChronicleStore,
  type SessionChronicleEntry,
} from "../../../src/storage/chronicle/session-chronicle-store.js";

function makeEntry(overrides: Partial<SessionChronicleEntry> = {}): SessionChronicleEntry {
  return {
    entryId: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    eventKind: "heartbeat",
    actor: "agent",
    occurredAt: new Date().toISOString(),
    summary: "test summary",
    result: "succeeded",
    sourceRefs: [{ sourceId: "src-1", kind: "test" }],
    ...overrides,
  };
}

test("appendSessionChronicle writes and returns ack", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  const entry = makeEntry();
  const ack = await store.appendSessionChronicle(entry);

  assert.equal(ack.entryId, entry.entryId);
  assert.equal(ack.status, "acknowledged");
});

test("loadSessionChronicle returns appended entries", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  const entry = makeEntry({ eventKind: "connector_action", summary: "action A" });
  await store.appendSessionChronicle(entry);

  const results = await store.loadSessionChronicle({});
  assert.equal(results.length, 1);
  assert.equal(results[0]!.entryId, entry.entryId);
  assert.equal(results[0]!.eventKind, "connector_action");
  assert.equal(results[0]!.summary, "action A");
  assert.equal(results[0]!.sourceRefs.length, 1);
  assert.equal(results[0]!.sourceRefs[0]!.sourceId, "src-1");
});

test("loadSessionChronicle filters by eventKind", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  await store.appendSessionChronicle(makeEntry({ eventKind: "heartbeat" }));
  await store.appendSessionChronicle(makeEntry({ eventKind: "outreach" }));
  await store.appendSessionChronicle(makeEntry({ eventKind: "dream_run" }));

  const results = await store.loadSessionChronicle({ eventKinds: ["heartbeat", "outreach"] });
  assert.equal(results.length, 2);
  assert.ok(results.some((r) => r.eventKind === "heartbeat"));
  assert.ok(results.some((r) => r.eventKind === "outreach"));
  assert.ok(!results.some((r) => r.eventKind === "dream_run"));
});

test("loadSessionChronicle filters by actor", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  await store.appendSessionChronicle(makeEntry({ actor: "agent" }));
  await store.appendSessionChronicle(makeEntry({ actor: "owner" }));

  const results = await store.loadSessionChronicle({ actor: "owner" });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.actor, "owner");
});

test("loadSessionChronicle respects limit", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  for (let i = 0; i < 5; i++) {
    await store.appendSessionChronicle(makeEntry({ occurredAt: new Date(Date.now() + i * 1000).toISOString() }));
  }

  const results = await store.loadSessionChronicle({ limit: 2 });
  assert.equal(results.length, 2);
});

test("loadSessionChronicle orders by occurredAt descending", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  const t1 = new Date(Date.now() - 2000).toISOString();
  const t2 = new Date(Date.now() - 1000).toISOString();
  const t3 = new Date(Date.now()).toISOString();

  await store.appendSessionChronicle(makeEntry({ occurredAt: t1 }));
  await store.appendSessionChronicle(makeEntry({ occurredAt: t3 }));
  await store.appendSessionChronicle(makeEntry({ occurredAt: t2 }));

  const results = await store.loadSessionChronicle({});
  assert.equal(results.length, 3);
  assert.equal(results[0]!.occurredAt, t3);
  assert.equal(results[1]!.occurredAt, t2);
  assert.equal(results[2]!.occurredAt, t1);
});

test("loadSessionChronicle filters by date range", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  await store.appendSessionChronicle(makeEntry({ occurredAt: "2026-05-10T00:00:00Z" }));
  await store.appendSessionChronicle(makeEntry({ occurredAt: "2026-05-15T00:00:00Z" }));
  await store.appendSessionChronicle(makeEntry({ occurredAt: "2026-05-20T00:00:00Z" }));

  const results = await store.loadSessionChronicle({
    from: "2026-05-12T00:00:00Z",
    to: "2026-05-18T00:00:00Z",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0]!.occurredAt, "2026-05-15T00:00:00Z");
});

test("ownerReply and related ids survive roundtrip", async () => {
  const db = createStateDatabase(":memory:");
  const store = createSessionChronicleStore(db);

  const entry = makeEntry({
    eventKind: "owner_reply",
    actor: "owner",
    relatedDecisionId: "dec-1",
    relatedDreamRunId: "dream-1",
    ownerReply: { tone: "casual", delayMinutes: 30, topics: ["dev"], explicitPreference: "quiet" },
  });
  await store.appendSessionChronicle(entry);

  const results = await store.loadSessionChronicle({});
  assert.equal(results.length, 1);
  assert.equal(results[0]!.relatedDecisionId, "dec-1");
  assert.equal(results[0]!.relatedDreamRunId, "dream-1");
  assert.deepEqual(results[0]!.ownerReply, entry.ownerReply);
});
