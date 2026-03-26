import test from "node:test";
import assert from "node:assert/strict";

import { collectGuidanceReviewChecklist } from "../../../src/guidance/review-workflow.js";

test("guidance review workflow includes every required template in one checklist", async () => {
  const checklist = await collectGuidanceReviewChecklist();

  assert.equal(checklist.items.length, 6);
  assert.ok(checklist.items.every((item) => item.reviewRequired));
  assert.ok(checklist.items.every((item) => item.relativePath.startsWith("src/guidance/templates/")));
  assert.ok(checklist.items.every((item) => item.reviewStatus === "pending_human_review"));
  assert.ok(checklist.items.every((item) => item.nextAction === "human_review_required"));
  assert.doesNotThrow(() => JSON.stringify(checklist));
});

test("review workflow keeps rejection path explicit through nextAction mapping", async () => {
  const checklist = await collectGuidanceReviewChecklist();
  const personaPolicy = checklist.items.find((item) => item.templateId === "persona.selection");

  assert.ok(personaPolicy);
  assert.equal(personaPolicy?.scope, "persona_reinforcement_policy");
  assert.equal(personaPolicy?.nextAction, "human_review_required");
});
