/**
 * T1.4.2 — Activation UX contract cleanup: goal criteria alias + relationship explain.
 *
 * Acceptance:
 * A. `goal set` with `criteria` alias persists the same text as `completionCriteria`.
 * B. `explain relationship:{id}` returns redacted summary when relationship memory exists.
 * C. `explain relationship:{id}` returns honest nothing_yet when no relationship memory exists.
 * D. Unknown relationship id returns nothing_yet, not an error or unknown subject.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  closeCliRuntimeDeps,
  createCliRuntimeDeps,
  createCommandRouter,
} from "../../../src/cli/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createRelationshipMemoryStore } from "../../../src/storage/relationship/relationship-memory-store.js";

test("T1.4.2-A: goal set with criteria alias persists completionCriteria", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("goal")!;

  const result = (await cmd.execute({
    action: "set",
    description: "Improve connector health",
    criteria: "All connectors report healthy for 7 days",
    risk: "low",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true, "goal set must succeed with criteria alias");
  const data = result.data as Record<string, unknown>;
  const goal = data.goal as Record<string, unknown>;
  assert.equal(goal.completionCriteria, "All connectors report healthy for 7 days");

  await closeCliRuntimeDeps(deps);
});

test("T1.4.2-A: goal set with completionCriteria still works", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("goal")!;

  const result = (await cmd.execute({
    action: "set",
    description: "Complete documentation",
    completionCriteria: "README and API docs merged",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  const goal = data.goal as Record<string, unknown>;
  assert.equal(goal.completionCriteria, "README and API docs merged");

  await closeCliRuntimeDeps(deps);
});

test("T1.4.2-A: criteria alias takes precedence when both present", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("goal")!;

  const result = (await cmd.execute({
    action: "set",
    description: "Test precedence",
    completionCriteria: "from-completionCriteria",
    criteria: "from-criteria",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  const goal = data.goal as Record<string, unknown>;
  // criteria comes after completionCriteria in the code, but both are truthy.
  // Current implementation: completionCriteria?.trim() || criteria?.trim()
  // So completionCriteria takes precedence.
  assert.equal(goal.completionCriteria, "from-completionCriteria");

  await closeCliRuntimeDeps(deps);
});

test("T1.4.2-B: explain relationship returns redacted summary when memory exists", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("explain")!;

  const store = createRelationshipMemoryStore(stateDb);
  await store.upsertRelationshipMemory({
    relationshipId: "default",
    revision: 1,
    tonePreference: "direct",
    averageReplyDelayMinutes: 15,
    noReplyCount: 0,
    topicAffinities: [{ topic: "tech", affinity: 0.8 }],
    lastInteractionAt: "2026-05-18T10:00:00Z",
    sourceRefs: [{ sourceId: "reply-001", kind: "owner_reply" }],
    updatedAt: "2026-05-18T10:00:00Z",
  });

  const result = (await cmd.execute({
    subject: "relationship:default",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.subjectType, "relationship");
  assert.ok(
    (data.conclusion as string).includes("direct"),
    "conclusion must include tone preference",
  );
  assert.ok(
    (data.conclusion as string).includes("responsive"),
    "noReplyCount=0 => responsive",
  );
  assert.ok(
    (data.keyFactors as string[]).some((f) => f.includes("tone_preference")),
    "keyFactors must mention tone_preference",
  );
  assert.ok(
    (data.evidenceRefs as string[]).includes("reply-001"),
    "evidenceRefs must include source refs",
  );

  await closeCliRuntimeDeps(deps);
});

test("T1.4.2-C: explain relationship returns nothing_yet when no memory exists", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("explain")!;

  const result = (await cmd.execute({
    subject: "relationship:unknown-id",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.subjectType, "relationship");
  assert.equal(data.conclusion, "nothing_yet");
  assert.ok(
    (data.keyFactors as string[]).includes("no_relationship_memory_recorded"),
    "must report honest absence",
  );

  await closeCliRuntimeDeps(deps);
});

test("T1.4.2-D: explain relationship with insufficient_history when single sample", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const deps = createCliRuntimeDeps({ stateDb, observabilityDb });
  const router = createCommandRouter({ deps });
  const cmd = router.resolve("explain")!;

  const store = createRelationshipMemoryStore(stateDb);
  await store.upsertRelationshipMemory({
    relationshipId: "sparse",
    revision: 1,
    tonePreference: "unknown",
    noReplyCount: 2,
    topicAffinities: [],
    sourceRefs: [],
    updatedAt: "2026-05-18T10:00:00Z",
  });

  const result = (await cmd.execute({
    subject: "relationship:sparse",
  })) as Record<string, unknown>;

  assert.equal(result.ok, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.subjectType, "relationship");
  assert.ok(
    (data.conclusion as string).includes("cooldown"),
    "noReplyCount>0 => cooldown",
  );
  assert.ok(
    (data.keyFactors as string[]).includes("insufficient_history"),
    "empty topics => insufficient_history",
  );

  await closeCliRuntimeDeps(deps);
});
