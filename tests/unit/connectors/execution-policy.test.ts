import test from "node:test";
import assert from "node:assert/strict";

import {
  enforceExecutionPolicy,
  InMemoryEffectCommitLedger,
  classifyConnectorIntentEffect,
} from "../../../src/connectors/base/execution-policy.js";
import { ConnectorPolicyError } from "../../../src/connectors/base/failure-taxonomy.js";
import type { ExecutionPlan } from "../../../src/connectors/base/contract.js";

const baseRequest = {
  platformId: "p1",
  intent: "message.send" as const,
  payload: {},
  decisionId: "dec-1",
  intentId: "int-1",
};

test("T3.2.1 side_effect without idempotency key is terminal policy failure", async () => {
  const plan: ExecutionPlan = {
    platformId: "p1",
    intent: "message.send",
    channel: "api_rest",
    endpointMode: "rest_json",
    degraded: false,
  };
  await assert.rejects(
    () => enforceExecutionPolicy(plan, "message.send", baseRequest, {}),
    (e: unknown) => e instanceof ConnectorPolicyError && e.failureClass === "permanent_input_error",
  );
});

test("T3.2.1 degraded channel blocks side_effect even with idempotency key", async () => {
  const plan: ExecutionPlan = {
    platformId: "p1",
    intent: "message.send",
    channel: "cli",
    endpointMode: "cli_stdout",
    idempotencyKey: "idem-1",
    degraded: true,
  };
  await assert.rejects(
    () => enforceExecutionPolicy(plan, "message.send", { ...baseRequest, idempotencyKey: "idem-1" }, {}),
    (e: unknown) => e instanceof ConnectorPolicyError && e.failureClass === "semantic_rejection",
  );
});

test("T3.2.1 committed idempotency key skips adapter (replay)", async () => {
  const ledger = new InMemoryEffectCommitLedger();
  ledger.seedCommitted("dec-1", "idem-replay", "outcome:prev");
  const plan: ExecutionPlan = {
    platformId: "p1",
    intent: "message.send",
    channel: "api_rest",
    endpointMode: "rest_json",
    idempotencyKey: "idem-replay",
    degraded: false,
  };
  const gate = await enforceExecutionPolicy(plan, "message.send", { ...baseRequest, idempotencyKey: "idem-replay" }, {
    effectCommitLedger: ledger,
  });
  assert.equal(gate.skipAdapter, true);
  assert.equal(gate.existingOutcomeRef, "outcome:prev");
});

test("T3.2.1 dispatched state requires reconcile", async () => {
  const ledger = new InMemoryEffectCommitLedger();
  await ledger.getOrCreateIntentCommitRecord({
    decisionId: "dec-1",
    intentId: "int-1",
    idempotencyKey: "idem-disp",
    effectClass: "side_effect",
  });
  ledger.markState("dec-1", "idem-disp", "dispatched");
  const plan: ExecutionPlan = {
    platformId: "p1",
    intent: "message.send",
    channel: "api_rest",
    endpointMode: "rest_json",
    idempotencyKey: "idem-disp",
    degraded: false,
  };
  await assert.rejects(
    () => enforceExecutionPolicy(plan, "message.send", { ...baseRequest, idempotencyKey: "idem-disp" }, { effectCommitLedger: ledger }),
    (e: unknown) => e instanceof ConnectorPolicyError && e.failureClass === "concurrency_conflict",
  );
});

test("T3.2.1 classify feed.read as read_only", () => {
  assert.equal(classifyConnectorIntentEffect("feed.read"), "read_only");
});
