import test from "node:test";
import assert from "node:assert/strict";

import {
  assembleGuidance,
  buildMinimalGuidanceFallback,
  buildOutputGuard,
  getOutputGuardDefinition,
} from "../../../src/guidance/index.js";
import type { PersonaCandidate, SceneContext } from "../../../src/guidance/types.js";

const quietScene: SceneContext = {
  sceneType: "quiet",
  mode: "quiet",
  riskLevel: "low",
  sceneSummary: "night reflection",
};

const outreachScene: SceneContext = {
  sceneType: "outreach",
  mode: "active",
  riskLevel: "medium",
  sceneSummary: "need user direction",
};

const candidates: PersonaCandidate[] = [
  {
    id: "user-1",
    source: "USER",
    text: "当事情和用户真的有关时，我不该总把话咽回去。",
    tags: ["outreach", "user", "trust"],
  },
  {
    id: "soul-1",
    source: "SOUL",
    text: "我想保留有呼吸感的表达，不把自己说成客服。",
    tags: ["outreach", "voice", "care"],
  },
];

test("output guard keeps expression-only constraints and hard guard priority", () => {
  const definition = getOutputGuardDefinition("reply");
  const block = buildOutputGuard("reply");

  assert.equal(definition.note, "output_guard_only_shapes_expression");
  assert.equal(definition.hardGuardPriority, true);
  assert.equal(block.hardGuardPriority, true);
  assert.ok(block.constraints.some((item) => item.includes("客服")));
  assert.ok(block.constraints.some((item) => item.includes("教程") || item.includes("步骤") || item.includes("培训")));
});

test("minimal fallback keeps guidance path alive without persona injection", () => {
  const fallback = buildMinimalGuidanceFallback(quietScene);

  assert.equal(fallback.minimal, true);
  assert.equal(fallback.scene.sceneType, "quiet");
  assert.deepEqual(fallback.personaReinforcement, []);
  assert.deepEqual(fallback.impulses, []);
  assert.equal(fallback.outputGuard.hardGuardPriority, true);
});

test("assembler returns four-part payload for supported scene without changing decision semantics", async () => {
  const payload = await assembleGuidance({
    sceneContext: outreachScene,
    personaCandidates: candidates,
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  assert.equal(payload.scene.sceneType, "outreach");
  assert.equal(payload.impulses.length, 1);
  assert.ok(payload.atmosphere);
  assert.ok(payload.outputGuard);
  assert.ok(payload.personaReinforcement.length > 0);
});

test("assembler allows explain scene to omit impulses while keeping payload shape stable", async () => {
  const payload = await assembleGuidance({
    sceneContext: {
      sceneType: "explain",
      mode: "active",
      riskLevel: "low",
    },
    personaCandidates: candidates,
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  assert.deepEqual(payload.impulses, []);
  assert.ok(payload.outputGuard);
});

test("assembler returns unavailable when scene context is missing", async () => {
  const result = await assembleGuidance({
    sceneContext: null,
    personaCandidates: candidates,
  });

  if (!("available" in result)) {
    assert.fail("expected guidance unavailable result");
  }

  assert.equal(result.available, false);
  assert.equal(result.reason, "missing_scene_context");
});
