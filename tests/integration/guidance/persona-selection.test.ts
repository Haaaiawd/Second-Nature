import test from "node:test";
import assert from "node:assert/strict";

import {
  getPersonaSelectionPolicy,
  selectPersonaSnippets,
} from "../../../src/guidance/persona-selection.js";
import type { PersonaCandidate, SceneContext } from "../../../src/guidance/types.js";

const candidates: PersonaCandidate[] = [
  {
    id: "soul-1",
    source: "SOUL",
    text: "我希望自己的表达有呼吸感，不想变成机械的总结器。",
    tags: ["quiet", "reflection", "voice"],
  },
  {
    id: "user-1",
    source: "USER",
    text: "和用户沟通时，我更珍惜清楚、节制但真诚的靠近。",
    tags: ["outreach", "user", "trust"],
  },
  {
    id: "memory-1",
    source: "MEMORY",
    text: "上一次主动联系是在真的需要方向确认时，对方更愿意接住简短但具体的消息。",
    tags: ["outreach", "memory", "care"],
  },
  {
    id: "identity-1",
    source: "IDENTITY",
    text: "我倾向于把原则讲清楚，但不会让解释压过正在发生的关系。",
    tags: ["explain", "principle", "clarity"],
  },
];

test("persona selection policy keeps scene-specific priority and snippet cap", () => {
  const sceneContext: SceneContext = {
    sceneType: "outreach",
    mode: "active",
    riskLevel: "low",
  };

  const decision = selectPersonaSnippets({ sceneContext, candidates });

  assert.equal(decision.budget.maxSnippets, 2);
  assert.ok(decision.snippets.length <= 2);
  assert.equal(decision.snippets[0]?.source, "USER");
  assert.ok(decision.snippets.every((snippet) => snippet.rationale.length > 0));
});

test("quiet scene allows slightly larger budget without full-document injection", () => {
  const sceneContext: SceneContext = {
    sceneType: "quiet",
    mode: "quiet",
    riskLevel: "low",
  };

  const longCandidate: PersonaCandidate = {
    id: "memory-long",
    source: "MEMORY",
    text: "quiet ".repeat(300),
    tags: ["quiet", "reflection", "memory"],
  };

  const decision = selectPersonaSnippets({
    sceneContext,
    candidates: [longCandidate, ...candidates],
  });

  assert.equal(decision.budget.maxSnippets, 3);
  assert.ok(decision.snippets.length <= 3);
  const totalCharacters = decision.snippets.reduce((sum, snippet) => sum + snippet.text.length, 0);
  assert.ok(totalCharacters <= decision.budget.maxTotalCharacters);
  assert.ok(decision.snippets[0]?.text.length < longCandidate.text.length);
});

test("policy lookup stays explicit for every guidance scene", () => {
  assert.deepEqual(getPersonaSelectionPolicy("social").sourcePriority, ["SOUL", "IDENTITY", "MEMORY", "USER"]);
  assert.deepEqual(getPersonaSelectionPolicy("reply").sourcePriority, ["USER", "IDENTITY", "SOUL", "MEMORY"]);
  assert.deepEqual(getPersonaSelectionPolicy("outreach").sourcePriority, ["USER", "SOUL", "MEMORY", "IDENTITY"]);
  assert.deepEqual(getPersonaSelectionPolicy("quiet").sourcePriority, ["SOUL", "MEMORY", "IDENTITY", "USER"]);
  assert.deepEqual(getPersonaSelectionPolicy("explain").sourcePriority, ["IDENTITY", "USER", "SOUL", "MEMORY"]);
});
