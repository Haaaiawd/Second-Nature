import test from "node:test";
import assert from "node:assert/strict";

import {
  assembleGuidance,
  buildMinimalGuidanceFallback,
  buildOutputGuard,
  buildExpressionBoundary,
  getOutputGuardDefinition,
  getShortAtmosphereTemplate,
  assembleImpulseSync,
} from "../../../src/guidance/index.js";
import type { PersonaCandidate, SceneContext, GuidanceMode, GuidanceRiskLevel } from "../../../src/guidance/types.js";

const quietScene: SceneContext = {
  sceneType: "quiet",
  mode: "quiet",
  riskLevel: "low",
  sceneSummary: "night reflection",
};

const activeHighRiskScene: SceneContext = {
  sceneType: "social",
  mode: "active",
  riskLevel: "high",
  sceneSummary: "hot topic",
};

const maintenanceScene: SceneContext = {
  sceneType: "explain",
  mode: "maintenance_only",
  riskLevel: "medium",
  sceneSummary: "system check",
};

const candidates: PersonaCandidate[] = [
  {
    id: "user-1",
    source: "USER",
    text: "当事情和用户真的有关时，我不该总把话咽回去。",
    tags: ["outreach", "user", "trust"],
  },
];

// ─── T-V7C.C.7: Expression Boundary Semantics ────────────────────────────────

test("buildExpressionBoundary returns expression_boundary kind with avoid_prefer style", () => {
  const boundary = buildExpressionBoundary("social");

  assert.equal(boundary.kind, "expression_boundary");
  assert.equal(boundary.style, "avoid_prefer");
  assert.equal(boundary.ownership, "behavioral_guidance_system");
  assert.ok(boundary.constraints.length > 0);
  assert.ok(
    boundary.constraints.every((c) => !c.includes("JSON") && !c.includes("Markdown") && !c.includes("格式")),
    "expression boundary must not prescribe fixed format",
  );
  assert.ok(
    boundary.constraints.some((c) => c.includes("避免") || c.includes("不要")),
    "constraints should be avoid/prefer style",
  );
});

test("buildOutputGuard remains backward compatible and marks expression-only semantics", () => {
  const block = buildOutputGuard("reply");

  assert.equal(block.kind, "output_guard");
  assert.equal(block.hardGuardPriority, true);
  assert.equal(block._semanticNote, "output_guard_only_shapes_expression");
  assert.ok(block.constraints.length > 0);
});

test("getOutputGuardDefinition documents expression-only intent", () => {
  const definition = getOutputGuardDefinition("outreach");

  assert.equal(definition.note, "output_guard_only_shapes_expression");
  assert.equal(definition.hardGuardPriority, true);
});

test("assembleGuidance returns both outputGuard (compat) and expressionBoundary (new semantic)", async () => {
  const payload = await assembleGuidance({
    sceneContext: quietScene,
    personaCandidates: candidates,
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  assert.ok(payload.outputGuard, "backward-compatible outputGuard must exist");
  assert.ok(payload.expressionBoundary, "new expressionBoundary must exist");
  assert.equal(payload.expressionBoundary.kind, "expression_boundary");
  assert.equal(payload.expressionBoundary.style, "avoid_prefer");
  assert.equal(payload.expressionBoundary.ownership, "behavioral_guidance_system");
});

test("minimal fallback carries expressionBoundary", () => {
  const fallback = buildMinimalGuidanceFallback(activeHighRiskScene);

  assert.equal(fallback.minimal, true);
  assert.ok(fallback.outputGuard);
  assert.ok(fallback.expressionBoundary);
  assert.equal(fallback.expressionBoundary.kind, "expression_boundary");
});

// ─── T-V7C.C.7: Atmosphere Short Constraint ──────────────────────────────────

test("getShortAtmosphereTemplate returns short constraint text under 120 chars", () => {
  const modes: GuidanceMode[] = ["active", "quiet", "maintenance_only", "paused_for_interrupt"];
  const risks: (GuidanceRiskLevel | undefined)[] = ["low", "medium", "high", undefined];

  for (const mode of modes) {
    for (const risk of risks) {
      const tmpl = getShortAtmosphereTemplate(mode, risk);
      assert.ok(tmpl.text.length <= 120, `atmosphere for ${mode}/${risk ?? "unknown"} too long: ${tmpl.text.length}`);
      assert.equal(tmpl.reviewStatus, "approved");
    }
  }
});

test("getShortAtmosphereTemplate varies by mode and risk", () => {
  const activeLow = getShortAtmosphereTemplate("active", "low").text;
  const activeHigh = getShortAtmosphereTemplate("active", "high").text;
  const quietLow = getShortAtmosphereTemplate("quiet", "low").text;

  assert.notEqual(activeLow, activeHigh, "active low and high should differ");
  assert.notEqual(activeLow, quietLow, "active and quiet should differ");
});

test("assembleGuidance uses short atmosphere instead of long baseline", async () => {
  const payload = await assembleGuidance({
    sceneContext: activeHighRiskScene,
    personaCandidates: [],
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  assert.ok(payload.atmosphere);
  assert.ok(
    payload.atmosphere.text.length <= 120,
    `atmosphere text too long: ${payload.atmosphere.text.length}`,
  );
});

// ─── T-V7C.C.7: agent.* exclusion ────────────────────────────────────────────

test("assembleImpulseSync excludes agent.* capabilities from impulse injection", () => {
  const result = assembleImpulseSync({
    sceneType: "social",
    capabilityIntent: "agent.heartbeat",
  });

  assert.equal(result.impulse, null);
  assert.equal(result.source, "none");
  assert.equal(result.capabilityClass, null);
});

test("assembleImpulseSync excludes agent.internal from impulse injection", () => {
  const result = assembleImpulseSync({
    sceneType: "social",
    capabilityIntent: "agent.internal.probe",
  });

  assert.equal(result.impulse, null);
  assert.equal(result.source, "none");
});

// ─── T-V7C.C.7: Hard guard boundary separation ───────────────────────────────

test("expressionBoundary ownership is behavioral_guidance_system, not hard-guard-layer", async () => {
  const payload = await assembleGuidance({
    sceneContext: maintenanceScene,
    personaCandidates: [],
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  assert.ok(payload.expressionBoundary);
  assert.equal(payload.expressionBoundary.ownership, "behavioral_guidance_system");
});

// ─── T-V7C.C.7: Legacy consumer compatibility ────────────────────────────────

test("GuidancePayload still allows reading outputGuard without field missing", async () => {
  const payload = await assembleGuidance({
    sceneContext: quietScene,
    personaCandidates: candidates,
  });

  if ("available" in payload) {
    assert.fail("expected guidance payload");
  }

  // Legacy consumer pattern
  const constraints = payload.outputGuard?.constraints ?? [];
  assert.ok(Array.isArray(constraints));
  assert.ok(constraints.length > 0);
});
