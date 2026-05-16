import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createNarrativeStateStore,
  type NarrativeStateUpdate,
} from "../../../src/storage/narrative/narrative-state-store.js";

function makeUpdate(overrides: Partial<NarrativeStateUpdate> = {}): NarrativeStateUpdate {
  return {
    narrativeId: "default",
    revision: 1,
    focus: "Building connector ecosystem",
    progress: ["T3.1.1 registry"],
    nextIntent: "T3.1.2 capability registry",
    confidence: 0.85,
    sourceRefs: [{ sourceId: "evidence-1", kind: "heartbeat" }],
    unsupportedClaims: [],
    status: "active",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("updateNarrativeState writes and load returns complete state", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  const update = makeUpdate();
  const ack = await store.updateNarrativeState(update);
  assert.equal(ack.narrativeId, "default");
  assert.equal(ack.status, "acknowledged");

  const loaded = await store.loadNarrativeState();
  assert.ok(loaded);
  assert.equal(loaded!.focus, "Building connector ecosystem");
  assert.equal(loaded!.status, "active");
  assert.equal(loaded!.progress.length, 1);
  assert.equal(loaded!.sourceRefs[0]!.sourceId, "evidence-1");
});

test("unsupportedClaims non-empty retains status", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  const update = makeUpdate({
    unsupportedClaims: ["claim without source"],
    status: "insufficient_sources",
  });
  await store.updateNarrativeState(update);

  const loaded = await store.loadNarrativeState();
  assert.ok(loaded);
  assert.equal(loaded!.status, "insufficient_sources");
  assert.equal(loaded!.unsupportedClaims.length, 1);
});

test("awaiting_sources status survives roundtrip", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  const update = makeUpdate({ status: "awaiting_sources" });
  await store.updateNarrativeState(update);

  const loaded = await store.loadNarrativeState();
  assert.equal(loaded!.status, "awaiting_sources");
});

test("update bumps revision and changes fields", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  await store.updateNarrativeState(makeUpdate({ revision: 1, focus: "A" }));
  await store.updateNarrativeState(makeUpdate({ revision: 2, focus: "B", nextIntent: "C" }));

  const loaded = await store.loadNarrativeState();
  assert.equal(loaded!.revision, 2);
  assert.equal(loaded!.focus, "B");
  assert.equal(loaded!.nextIntent, "C");
});

test("loadNarrativeState returns null when nothing written", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  const loaded = await store.loadNarrativeState("missing");
  assert.equal(loaded, null);
});

test("updateNarrativeState with custom narrativeId", async () => {
  const db = createStateDatabase(":memory:");
  const store = createNarrativeStateStore(db);

  await store.updateNarrativeState(makeUpdate({ narrativeId: "custom-1", focus: "Custom" }));
  const loadedDefault = await store.loadNarrativeState("default");
  const loadedCustom = await store.loadNarrativeState("custom-1");

  assert.equal(loadedDefault, null);
  assert.ok(loadedCustom);
  assert.equal(loadedCustom!.focus, "Custom");
});
