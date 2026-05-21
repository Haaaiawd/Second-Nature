import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createRelationshipMemoryStore,
  type RelationshipMemoryUpdate,
} from "../../../src/storage/relationship/relationship-memory-store.js";

function makeUpdate(overrides: Partial<RelationshipMemoryUpdate> = {}): RelationshipMemoryUpdate {
  return {
    relationshipId: "default",
    revision: 1,
    tonePreference: "casual",
    averageReplyDelayMinutes: 15,
    noReplyCount: 0,
    topicAffinities: [{ topic: "coding", affinity: 0.9 }],
    lastInteractionAt: new Date().toISOString(),
    sourceRefs: [{ sourceId: "reply-1", kind: "owner_reply" }],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("upsertRelationshipMemory writes and load returns complete memory", async () => {
  const db = createStateDatabase(":memory:");
  const store = createRelationshipMemoryStore(db);

  const update = makeUpdate();
  const ack = await store.upsertRelationshipMemory(update);
  assert.equal(ack.relationshipId, "default");

  const loaded = await store.loadRelationshipMemory();
  assert.ok(loaded);
  assert.equal(loaded!.tonePreference, "casual");
  assert.equal(loaded!.averageReplyDelayMinutes, 15);
  assert.equal(loaded!.topicAffinities[0]!.topic, "coding");
  assert.equal(loaded!.sourceRefs[0]!.sourceId, "reply-1");
});

test("noReplyCount increment records cooldown without invented preference", async () => {
  const db = createStateDatabase(":memory:");
  const store = createRelationshipMemoryStore(db);

  await store.upsertRelationshipMemory(makeUpdate({ noReplyCount: 0 }));
  await store.upsertRelationshipMemory(makeUpdate({ noReplyCount: 1, averageReplyDelayMinutes: undefined }));

  const loaded = await store.loadRelationshipMemory();
  assert.ok(loaded);
  assert.equal(loaded!.noReplyCount, 1);
  assert.equal(loaded!.averageReplyDelayMinutes, undefined);
  // tonePreference should still be what was recorded, not invented
  assert.equal(loaded!.tonePreference, "casual");
});

test("unknown tonePreference when insufficient history", async () => {
  const db = createStateDatabase(":memory:");
  const store = createRelationshipMemoryStore(db);

  await store.upsertRelationshipMemory(
    makeUpdate({ tonePreference: "unknown", topicAffinities: [] }),
  );

  const loaded = await store.loadRelationshipMemory();
  assert.equal(loaded!.tonePreference, "unknown");
});

test("upsert bumps revision and updates topicAffinities", async () => {
  const db = createStateDatabase(":memory:");
  const store = createRelationshipMemoryStore(db);

  await store.upsertRelationshipMemory(makeUpdate({ revision: 1, topicAffinities: [{ topic: "a", affinity: 0.5 }] }));
  await store.upsertRelationshipMemory(makeUpdate({ revision: 2, topicAffinities: [{ topic: "a", affinity: 0.8 }, { topic: "b", affinity: 0.3 }] }));

  const loaded = await store.loadRelationshipMemory();
  assert.equal(loaded!.revision, 2);
  assert.equal(loaded!.topicAffinities.length, 2);
});

test("loadRelationshipMemory returns null when nothing written", async () => {
  const db = createStateDatabase(":memory:");
  const store = createRelationshipMemoryStore(db);

  const loaded = await store.loadRelationshipMemory("missing");
  assert.equal(loaded, null);
});
