import test from "node:test";
import assert from "node:assert/strict";

import { buildOutreachMessage } from "../../../src/core/second-nature/index.js";

test("outreach message builder returns intent-level guidance instead of fixed final wording", () => {
  const message = buildOutreachMessage({
    summary: "need confirmation on platform direction",
    evaluation: {
      valueScore: 0.82,
      novelty: 0.7,
      userRelevance: 0.9,
      actionability: 0.8,
      urgency: 0.4,
      requiredUserHelp: true,
      isRoutineProgress: false,
      minThreshold: 0.65,
      sourceRefs: ["report:2026-03-25"],
      explanation: "high value",
    },
  });

  assert.equal(message.style, "intent_level_guidance");
  assert.equal(message.maxSentences, 3);
  assert.equal(message.intent.coreMeaning, "need confirmation on platform direction");
  assert.ok(message.intent.whyNow.includes("需要对方"));
  assert.ok(message.intent.deliveryBoundary.some((item) => item.includes("日报") || item.includes("工单")));
  assert.ok(message.intent.soulAlignment.includes("判断") || message.intent.soulAlignment.includes("在意"));
});

test("outreach intent guidance keeps final phrasing open instead of returning a ready-to-send message", () => {
  const message = buildOutreachMessage({
    summary: "share a useful update",
    evaluation: {
      valueScore: 0.9,
      novelty: 0.8,
      userRelevance: 0.85,
      actionability: 0.7,
      urgency: 0.9,
      requiredUserHelp: false,
      isRoutineProgress: false,
      minThreshold: 0.65,
      sourceRefs: ["report:2026-03-25"],
      explanation: "high value",
    },
  });

  assert.ok(!("text" in message));
  assert.ok(message.intent.deliveryBoundary.some((item) => item.includes("不要预写死整段最终措辞")));
  assert.ok(message.avoidFormats.includes("status_broadcast"));
});
