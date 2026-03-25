import test from "node:test";
import assert from "node:assert/strict";

import { EffectDispatcher, LeaseManager, buildDecisionContext, type AllowedIntent } from "../../../src/core/second-nature/index.js";

test("effect dispatcher wires state-owned commit protocol and lease for external effects", async () => {
  const calls: string[] = [];
  const dispatcher = new EffectDispatcher(
    new LeaseManager(),
    {
      async createIntentCommitRecord(input) {
        calls.push(`create:${input.state}`);
        return { id: "commit-1" };
      },
      async advanceIntentCommitState(_id, state) {
        calls.push(`advance:${state}`);
      },
      async commitIntentOutcome(_id, outcome) {
        calls.push(`commit:${outcome.outcomeRef}`);
      },
      async abortIntentCommit(_id, reason) {
        calls.push(`abort:${reason}`);
      },
    },
    {
      async executeEffect() {
        return {
          status: "success",
          metadata: {
            platformId: "instreet",
            channel: "api_rest",
            latencyMs: 1,
          },
          data: { ok: true },
        };
      },
    },
    {
      async saveCheckpoint(input) {
        calls.push(`checkpoint:${input.phase}`);
      },
    },
    {
      async persistCurationResult() {
        calls.push("curation");
      },
    },
    {
      async runNarrativeReflection() {
        calls.push("reflection");
        return { outcomeRef: "reflection-artifact" };
      },
    }
  );

  const intent: AllowedIntent = {
    id: "intent-1",
    kind: "social",
    summary: "reply",
    effectClass: "external_platform_action",
    platformId: "instreet",
    payload: { text: "hello" },
  };
  const context = buildDecisionContext({ tickId: "tick-1", intentId: "intent-1", decisionId: "decision-1" });
  const result = await dispatcher.dispatchEffect(intent, context);

  assert.equal(result.status, "effect_executed");
  assert.deepEqual(calls, [
    "checkpoint:before_effect",
    "create:planned",
    "advance:dispatched",
    "advance:externally_acknowledged",
    "commit:instreet",
  ]);
});

test("effect dispatcher keeps lease/checkpoint scoped by effect class", async () => {
  const calls: string[] = [];
  const dispatcher = new EffectDispatcher(
    new LeaseManager(),
    {
      async createIntentCommitRecord() {
        return { id: "commit-2" };
      },
      async advanceIntentCommitState(_id, state) {
        calls.push(`advance:${state}`);
      },
      async commitIntentOutcome() {
        calls.push("commit");
      },
      async abortIntentCommit() {
        calls.push("abort");
      },
    },
    {
      async executeEffect() {
        throw new Error("should_not_execute_for_maintenance");
      },
    },
    {
      async saveCheckpoint() {
        calls.push("checkpoint");
      },
    },
    {
      async persistCurationResult() {
        calls.push("curation");
      },
    },
    {
      async runNarrativeReflection() {
        return { outcomeRef: "reflection-artifact" };
      },
    }
  );

  const maintenance: AllowedIntent = {
    id: "intent-maint",
    kind: "maintenance",
    summary: "housekeeping",
    effectClass: "maintenance",
  };
  const context = buildDecisionContext({ tickId: "tick-2", intentId: "intent-maint", decisionId: "decision-2" });

  const result = await dispatcher.dispatchEffect(maintenance, context);
  assert.equal(result.status, "maintenance_done");
  assert.deepEqual(calls, ["advance:dispatched", "commit"]);
});

test("effect dispatcher advances non-external effects through dispatched before committed", async () => {
  const calls: string[] = [];
  const dispatcher = new EffectDispatcher(
    new LeaseManager(),
    {
      async createIntentCommitRecord() {
        calls.push("create:planned");
        return { id: "commit-3" };
      },
      async advanceIntentCommitState(_id, state) {
        calls.push(`advance:${state}`);
      },
      async commitIntentOutcome() {
        calls.push("commit");
      },
      async abortIntentCommit() {
        calls.push("abort");
      },
    },
    {
      async executeEffect() {
        throw new Error("should_not_execute_for_reflection");
      },
    },
    {
      async saveCheckpoint(input) {
        calls.push(`checkpoint:${input.phase}`);
      },
    },
    {
      async persistCurationResult() {
        calls.push("curation");
      },
    },
    {
      async runNarrativeReflection() {
        calls.push("reflection");
        return { outcomeRef: "reflection-artifact" };
      },
    }
  );

  const reflectionIntent: AllowedIntent = {
    id: "intent-reflect",
    kind: "reflection",
    summary: "reflect",
    effectClass: "narrative_reflection",
  };

  const result = await dispatcher.dispatchEffect(
    reflectionIntent,
    buildDecisionContext({ tickId: "tick-3", intentId: "intent-reflect", decisionId: "decision-3" })
  );

  assert.equal(result.status, "reflected");
  assert.deepEqual(calls, [
    "checkpoint:before_quiet_write",
    "create:planned",
    "advance:dispatched",
    "reflection",
    "commit",
  ]);
});
