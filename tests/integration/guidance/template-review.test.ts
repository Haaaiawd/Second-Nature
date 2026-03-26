import test from "node:test";
import assert from "node:assert/strict";

import { collectGuidanceReviewChecklist } from "../../../src/guidance/review-workflow.js";

test("guidance review workflow includes every required template in one checklist", async () => {
  const checklist = await collectGuidanceReviewChecklist();

  assert.equal(checklist.items.length, 6);
  assert.ok(checklist.items.every((item) => item.reviewRequired));
  assert.ok(checklist.items.every((item) => item.relativePath.startsWith("src/guidance/templates/")));
  assert.ok(checklist.items.every((item) => ["pending_human_review", "approved", "rejected"].includes(item.reviewStatus)));
  assert.doesNotThrow(() => JSON.stringify(checklist));
});

test("review workflow maps approved templates to ready_for_runtime_use", async () => {
  const checklist = await collectGuidanceReviewChecklist();
  const personaPolicy = checklist.items.find((item) => item.templateId === "persona.selection");

  assert.ok(personaPolicy);
  assert.equal(personaPolicy?.scope, "persona_reinforcement_policy");
  assert.equal(personaPolicy?.reviewStatus, "approved");
  assert.equal(personaPolicy?.nextAction, "ready_for_runtime_use");
});

test("review workflow marks approved outreach template as ready_for_runtime_use", async () => {
  const checklist = await collectGuidanceReviewChecklist();
  const outreach = checklist.items.find((item) => item.templateId === "impulse.outreach");

  assert.ok(outreach);
  assert.equal(outreach?.reviewStatus, "approved");
  assert.equal(outreach?.nextAction, "ready_for_runtime_use");
});
