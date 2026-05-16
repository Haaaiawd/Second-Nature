import test from "node:test";
import assert from "node:assert/strict";

import { draftRelationshipFromDream } from "../../../src/dream/relationship-update-proposal.js";

test("T7.1.5 reply entries produce tone/timing/topic deltas with sourceRefs", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "Thanks for the help, really appreciate it",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "owner_reply",
      },
      {
        id: "ch-2",
        summary: "Great work on the feature, love it",
        createdAt: "2026-05-11T10:00:00Z",
        kind: "owner_reply",
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(result.proposal!.toneDelta);
  assert.ok(result.proposal!.sourceRefs.includes("ch-1"));
  assert.ok(result.proposal!.sourceRefs.includes("ch-2"));
  assert.ok(result.proposal!.confidence > 0);
  assert.equal(result.cooldown, undefined);
});

test("T7.1.5 busy timing is detected", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "Sorry, I'm busy this week, tight schedule",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "owner_reply",
      },
      {
        id: "ch-2",
        summary: "Swamped with work, will reply later",
        createdAt: "2026-05-11T10:00:00Z",
        kind: "owner_reply",
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(result.proposal!.timingDelta?.includes("busy"));
});

test("T7.1.5 no owner reply returns cooldown without inventing preference", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "Sent outreach message",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "outreach",
      },
    ],
  });

  assert.equal(result.proposal, undefined);
  assert.equal(result.cooldown, true);
  assert.equal(result.unsupportedClaims.length, 0);
});

test("T7.1.5 single sample flags unsupported claim to prevent over-inference", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "Thanks for the update",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "owner_reply",
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(
    result.unsupportedClaims.includes("single_sample_insufficient_for_relationship_inference"),
  );
});

test("T7.1.5 topic deltas are detected from keywords", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "The code looks good, nice architecture design",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "owner_reply",
      },
      {
        id: "ch-2",
        summary: "System bug fixed, tests passing now",
        createdAt: "2026-05-11T10:00:00Z",
        kind: "owner_reply",
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(result.proposal!.topicDelta);
});

test("T7.1.5 negative tone is detected", () => {
  const result = draftRelationshipFromDream({
    chronicleEntries: [
      {
        id: "ch-1",
        summary: "Frustrated that this keeps breaking",
        createdAt: "2026-05-10T10:00:00Z",
        kind: "owner_reply",
      },
      {
        id: "ch-2",
        summary: "Disappointed with the delay",
        createdAt: "2026-05-11T10:00:00Z",
        kind: "owner_reply",
      },
    ],
  });

  assert.ok(result.proposal);
  assert.ok(result.proposal!.toneDelta?.includes("negative"));
});
