import test from "node:test";
import assert from "node:assert/strict";

import { projectGuidanceParticipationAudit } from "../../../src/observability/projections/guidance-audit.js";

test("guidance participation projection keeps guidance facts distinct from hard veto semantics", () => {
  const projection = projectGuidanceParticipationAudit({
    id: "guidance-1",
    usedFallback: false,
    sceneContext: {
      sceneType: "outreach",
      mode: "active",
      riskLevel: "low",
    },
    payload: {
      scene: {
        sceneType: "outreach",
        mode: "active",
        riskLevel: "low",
      },
      atmosphere: {
        kind: "atmosphere",
        text: "atm",
        openness: "open",
        pressureLabels: ["active"],
        reviewStatus: "pending_human_review",
      },
      impulses: [{ kind: "outreach", text: "impulse", reviewStatus: "pending_human_review" }],
      personaReinforcement: [{ candidateId: "p1", source: "USER", text: "snippet", rationale: "因为和当前用户关系直接相关" }],
      outputGuard: { kind: "output_guard", constraints: ["avoid customer service tone"], hardGuardPriority: true },
    },
  });

  assert.equal(projection.eventId, "guidance-1");
  assert.equal(projection.guidanceAvailable, true);
  assert.equal(projection.usedFallback, false);
  assert.ok(projection.blockSummary.includes("output_guard"));
  assert.ok(projection.snippetRationales[0]?.includes("当前用户关系"));
});

test("guidance participation projection keeps unavailable path explainable", () => {
  const projection = projectGuidanceParticipationAudit({
    id: "guidance-2",
    usedFallback: true,
    sceneContext: {
      sceneType: "reply",
      mode: "active",
      riskLevel: "high",
    },
    payload: {
      available: false,
      reason: "missing_template",
    },
  });

  assert.equal(projection.guidanceAvailable, false);
  assert.equal(projection.usedFallback, true);
  assert.deepEqual(projection.snippetRationales, []);
  assert.ok(projection.blockSummary.includes("unavailable:missing_template"));
});
