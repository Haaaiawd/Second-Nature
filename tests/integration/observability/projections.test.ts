import test from "node:test";
import assert from "node:assert/strict";

import { projectReflectionAudit } from "../../../src/observability/projections/reflection-audit.js";
import { projectOutreachQualityAudit } from "../../../src/observability/projections/outreach-quality-audit.js";

test("reflection projection keeps extension fields serializable", () => {
  const projection = projectReflectionAudit({
    id: "reflection-1",
    claimCount: 5,
    unsupportedClaimCount: 1,
    sourceCoverageRatio: 0.8,
    reflectionDebt: 2,
    starved: false,
    modelEvalRef: "model-eval-1",
  });

  assert.equal(projection.eventId, "reflection-1");
  assert.equal(projection.unsupportedClaimCount, 1);
  assert.equal(projection.sourceCoverageRatio, 0.8);
  assert.equal(projection.claimCount, 5);
  assert.equal(projection.modelEvalRef, "model-eval-1");
  assert.doesNotThrow(() => JSON.stringify(projection));
});

test("outreach quality projection keeps value and suppression fields", () => {
  const projection = projectOutreachQualityAudit({
    id: "outreach-1",
    valueScore: 0.73,
    noveltyScore: 0.51,
    requiredUserAction: true,
    suppressionReason: "cooldown",
  });

  assert.equal(projection.eventId, "outreach-1");
  assert.equal(projection.valueScore, 0.73);
  assert.equal(projection.noveltyScore, 0.51);
  assert.equal(projection.requiredUserAction, true);
  assert.equal(projection.suppressionReason, "cooldown");
  assert.doesNotThrow(() => JSON.stringify(projection));
});
