/**
 * T2.2.3 extension — connector_action with wired connectorExecutor.
 *
 * When connectorExecutor is present, resolveAllowedIntentResult dispatches
 * through the connector-system instead of returning connector_dispatch_unwired.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolveAllowedIntentResult } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { ConnectorExecutor } from "../../../src/connectors/base/contract.js";

const signal: HeartbeatSignal = {
  trigger: "heartbeat_bridge",
  scopeHint: "rhythm",
  payload: { timestamp: "2026-05-10T10:00:00.000Z" },
};

const baseInputs: SnapshotInputs = {
  mode: "active",
  currentWindowId: "win_work_morning",
  pendingObligations: [],
  recentOutreachHashes: [],
  deniedIntents: [],
};

function makeRuntime(inputs: SnapshotInputs) {
  const continuity = buildContinuitySnapshot(inputs);
  return buildHeartbeatRuntimeSnapshot(
    "2026-05-10T10:00:00.000Z",
    inputs,
    continuity,
  );
}

function makeExplorationIntent(): CandidateIntent {
  return {
    id: "intent-conn-explore",
    kind: "exploration",
    priority: 30,
    source: "tick",
    summary: "explore moltbook feed",
    effectClass: "connector_action",
    platformId: "moltbook",
    sourceRefs: [{ id: "s1", family: "evidence", uri: "moltbook://item/1", redactionClass: "none" }],
    idempotencyKey: "conn:explore",
  };
}

// ─── Case F: connectorExecutor present + success → connector_effect_executed ─────

test("T2.2.3 F — connector_action with executor success → connector_effect_executed", async () => {
  const executor: ConnectorExecutor = {
    async executeEffect() {
      return {
        status: "success",
        data: { items: [{ id: "mb-1", title: "test" }] },
        metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 5 },
      };
    },
  };

  const runtime = makeRuntime(baseInputs);
  const result = await resolveAllowedIntentResult(
    makeExplorationIntent(),
    runtime,
    baseInputs,
    signal,
    { connectorExecutor: executor },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(
    result.reasons.includes("connector_effect_executed"),
    `Expected connector_effect_executed, got: ${JSON.stringify(result.reasons)}`,
  );
  assert.ok(result.decisionId, "expected decisionId to be set");
});

// ─── Case G: connectorExecutor present + retryable failure → connector_retryable_failure ─

test("T2.2.3 G — connector_action with executor retryable_failure → connector_retryable_failure", async () => {
  const executor: ConnectorExecutor = {
    async executeEffect() {
      return {
        status: "retryable_failure",
        failureClass: "rate_limited",
        retryAfterMs: 30000,
        metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 2 },
      };
    },
  };

  const runtime = makeRuntime(baseInputs);
  const result = await resolveAllowedIntentResult(
    makeExplorationIntent(),
    runtime,
    baseInputs,
    signal,
    { connectorExecutor: executor },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(
    result.reasons.includes("connector_retryable_failure"),
    `Expected connector_retryable_failure, got: ${JSON.stringify(result.reasons)}`,
  );
  assert.ok(
    result.reasons.includes("rate_limited"),
    `Expected rate_limited in reasons, got: ${JSON.stringify(result.reasons)}`,
  );
});

// ─── Case H: connectorExecutor present + terminal failure → connector_terminal_failure ──

test("T2.2.3 H — connector_action with executor terminal failure → connector_terminal_failure", async () => {
  const executor: ConnectorExecutor = {
    async executeEffect() {
      return {
        status: "terminal_failure",
        failureClass: "auth_failure",
        metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 1 },
      };
    },
  };

  const runtime = makeRuntime(baseInputs);
  const result = await resolveAllowedIntentResult(
    makeExplorationIntent(),
    runtime,
    baseInputs,
    signal,
    { connectorExecutor: executor },
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(
    result.reasons.includes("connector_terminal_failure"),
    `Expected connector_terminal_failure, got: ${JSON.stringify(result.reasons)}`,
  );
  assert.ok(
    result.reasons.includes("auth_failure"),
    `Expected auth_failure in reasons, got: ${JSON.stringify(result.reasons)}`,
  );
});

// ─── Case I: no connectorExecutor → still returns connector_dispatch_unwired ──────

test("T2.2.3 I — connector_action without executor still returns connector_dispatch_unwired", async () => {
  const runtime = makeRuntime(baseInputs);
  const result = await resolveAllowedIntentResult(
    makeExplorationIntent(),
    runtime,
    baseInputs,
    signal,
    {},
  );

  assert.equal(result.status, "intent_selected");
  assert.ok(
    result.reasons.includes("connector_dispatch_unwired"),
    `Expected connector_dispatch_unwired, got: ${JSON.stringify(result.reasons)}`,
  );
});
