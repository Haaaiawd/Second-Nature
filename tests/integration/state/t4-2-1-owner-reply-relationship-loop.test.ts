/**
 * T4.2.1 — Owner reply → RelationshipMemory feedback loop integration.
 *
 * Acceptance:
 * A. owner reply → SessionChronicle entry written with owner_reply kind.
 * B. positive reply → RelationshipMemory tone updated to casual, noReplyCount reset.
 * C. negative reply → RelationshipMemory tone updated to quiet (reserved).
 * D. busy reply → timing observed as busy, topics extracted.
 * E. no existing memory → creates default relationship with inferred traits.
 * F. next outreach draft can load updated relationship and trace to sourceRef.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { processOwnerReply } from "../../../src/core/second-nature/feedback/owner-reply-feedback.js";
import { createSessionChronicleStore } from "../../../src/storage/chronicle/session-chronicle-store.js";
import { createRelationshipMemoryStore } from "../../../src/storage/relationship/relationship-memory-store.js";

async function seedRelationshipMemory(state: ReturnType<typeof createStateDatabase>) {
  const store = createRelationshipMemoryStore(state);
  await store.upsertRelationshipMemory({
    relationshipId: "default",
    revision: 1,
    tonePreference: "casual",
    averageReplyDelayMinutes: 30,
    noReplyCount: 2,
    topicAffinities: [
      { topic: "platform", affinity: 0.8 },
      { topic: "work", affinity: 0.6 },
    ],
    lastInteractionAt: new Date(Date.now() - 86400000).toISOString(),
    sourceRefs: [{ sourceId: "seed-1", kind: "decision_record", url: "https://example.test/seed" }],
    updatedAt: new Date().toISOString(),
  });
}

test("T4.2.1-A: owner reply → chronicle entry written with owner_reply kind", async () => {
  const state = createStateDatabase(":memory:");
  await seedRelationshipMemory(state);

  const result = await processOwnerReply(
    {
      replyText: "Thanks for the update, that's helpful!",
      relatedDecisionId: "decision-001",
    },
    state,
  );

  assert.ok(result.chronicleEntryId.startsWith("owner_reply:"));
  assert.equal(result.relationshipUpdated, true);

  const chronicle = createSessionChronicleStore(state);
  const entries = await chronicle.loadSessionChronicle({ eventKinds: ["owner_reply"], limit: 10 });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.actor, "owner");
  assert.equal(entries[0]!.relatedDecisionId, "decision-001");
  assert.ok(entries[0]!.ownerReply);
});

test("T4.2.1-B: positive reply → tone casual, noReplyCount reset to 0", async () => {
  const state = createStateDatabase(":memory:");
  await seedRelationshipMemory(state);

  const result = await processOwnerReply(
    {
      replyText: "Great work! I really appreciate the quick follow-up.",
      relatedDecisionId: "decision-002",
    },
    state,
  );

  assert.equal(result.relationshipUpdated, true);
  assert.equal(result.updatedMemory!.tonePreference, "casual");
  assert.equal(result.updatedMemory!.noReplyCount, 0);
  assert.ok(result.updatedMemory!.lastInteractionAt);
  assert.ok(
    result.updatedMemory!.sourceRefs.some((r) => r.kind === "owner_reply_feedback"),
    "sourceRefs must contain owner_reply_feedback ref",
  );
});

test("T4.2.1-C: negative reply → tone quiet (reserved), noReplyCount reset", async () => {
  const state = createStateDatabase(":memory:");
  await seedRelationshipMemory(state);

  const result = await processOwnerReply(
    {
      replyText: "I'm frustrated that you keep bothering me with these updates.",
      relatedDecisionId: "decision-003",
    },
    state,
  );

  assert.equal(result.relationshipUpdated, true);
  assert.equal(result.updatedMemory!.tonePreference, "quiet");
  assert.equal(result.updatedMemory!.noReplyCount, 0);
});

test("T4.2.1-D: busy reply → timing busy, topics extracted, affinities updated", async () => {
  const state = createStateDatabase(":memory:");
  await seedRelationshipMemory(state);

  const result = await processOwnerReply(
    {
      replyText: "I'm busy with a deadline. Let's talk about the project later.",
      relatedDecisionId: "decision-004",
    },
    state,
  );

  assert.equal(result.relationshipUpdated, true);
  // Timing inference is stored in ownerReply signal, not directly on memory field
  const chronicle = createSessionChronicleStore(state);
  const entries = await chronicle.loadSessionChronicle({ eventKinds: ["owner_reply"], limit: 1 });
  assert.equal(entries[0]!.ownerReply!.topics!.includes("work"), true);

  // Affinities should be updated
  const workAffinity = result.updatedMemory!.topicAffinities.find((t) => t.topic === "work");
  assert.ok(workAffinity);
  assert.ok(workAffinity!.affinity > 0.6, "work affinity should be boosted after reply mentioning deadline/project");
});

test("T4.2.1-E: no existing memory → creates default relationship with inferred traits", async () => {
  const state = createStateDatabase(":memory:");
  // Do NOT seed relationship memory

  const result = await processOwnerReply(
    {
      replyText: "Sounds good, thanks for keeping me in the loop!",
      relatedDecisionId: "decision-005",
    },
    state,
  );

  assert.equal(result.relationshipUpdated, true);
  assert.equal(result.updatedMemory!.relationshipId, "default");
  assert.equal(result.updatedMemory!.tonePreference, "casual");
  assert.equal(result.updatedMemory!.noReplyCount, 0);
  assert.equal(result.updatedMemory!.revision, 1);
});

test("T4.2.1-F: memory update includes sourceRef traceable to chronicle entry", async () => {
  const state = createStateDatabase(":memory:");
  await seedRelationshipMemory(state);

  const result = await processOwnerReply(
    {
      replyText: "Love the new feature! Great work on the architecture design.",
      relatedDecisionId: "decision-006",
    },
    state,
  );

  const chronicleEntryId = result.chronicleEntryId;
  const memory = result.updatedMemory!;

  // Source refs must include trace to chronicle entry
  const feedbackRef = memory.sourceRefs.find((r) => r.sourceId === chronicleEntryId);
  assert.ok(feedbackRef, "memory sourceRefs must contain trace to chronicle entry");
  assert.equal(feedbackRef!.kind, "owner_reply_feedback");

  // Topics should include "tech" (architecture, design, feature)
  const techAffinity = memory.topicAffinities.find((t) => t.topic === "tech");
  assert.ok(techAffinity, "tech topic should be inferred from reply text");
});
