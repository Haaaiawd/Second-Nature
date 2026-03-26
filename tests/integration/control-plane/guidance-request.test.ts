import test from "node:test";
import assert from "node:assert/strict";

import { requestGuidance } from "../../../src/core/second-nature/guidance/request-guidance.js";
import { applyGuidance } from "../../../src/core/second-nature/guidance/apply-guidance.js";
import type { GuidancePayload } from "../../../src/guidance/index.js";

test("control-plane remains the unique guidance request owner and applies payload context", async () => {
  const result = await requestGuidance({
    sceneContext: {
      sceneType: "reply",
      mode: "active",
      riskLevel: "low",
    },
    personaCandidates: [],
    port: {
      async assembleGuidance() {
        return {
          scene: {
            sceneType: "reply",
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
          impulses: [{ kind: "reply", text: "impulse", reviewStatus: "pending_human_review" }],
          personaReinforcement: [],
          outputGuard: { kind: "output_guard", constraints: ["c1"], hardGuardPriority: true },
        } satisfies GuidancePayload;
      },
    },
  });

  assert.equal(result.owner, "control-plane-system");
  assert.equal(result.usedFallback, false);
  const applied = applyGuidance(result.guidance);
  assert.equal(applied.source, "guidance_payload");
  assert.equal(applied.sceneType, "reply");
});

test("control-plane request falls back to minimal guidance when guidance is unavailable", async () => {
  const result = await requestGuidance({
    sceneContext: {
      sceneType: "quiet",
      mode: "quiet",
      riskLevel: "medium",
    },
    personaCandidates: [],
    port: {
      async assembleGuidance() {
        return {
          available: false as const,
          reason: "missing_template" as const,
        };
      },
    },
  });

  assert.equal(result.owner, "control-plane-system");
  assert.equal(result.usedFallback, true);
  const applied = applyGuidance(result.guidance);
  assert.equal(applied.source, "minimal_fallback");
  assert.equal(applied.sceneType, "quiet");
});
