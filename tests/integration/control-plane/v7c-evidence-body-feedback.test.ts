/**
 * T-V7C.C.2 集成测试 — Evidence + Body Feedback Closure
 *
 * 验收标准:
 *  - heartbeat connector success 写 ToolExperience + life_evidence, triggerSource="heartbeat"
 *  - heartbeat connector failure 也写 ToolExperience, triggerSource="heartbeat"
 *  - guard-layer 在有 painful affordance (circuit open) 时 defer connector intent
 *  - guard-layer 在有 unavailable affordance 时 defer connector intent
 *  - guard-layer 在有 safe affordance 时 allow connector intent
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { ingestRhythmSignal, type HeartbeatDeps } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import { evaluateHardGuards } from "../../../src/core/second-nature/orchestrator/guard-layer.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { ConnectorResult } from "../../../src/connectors/base/contract.js";
import type { ExperienceWriter } from "../../../src/core/second-nature/body/tool-experience/experience-writer.js";
import type { AffordanceMap } from "../../../src/shared/types/v7-entities.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_TIMESTAMP = "2026-05-25T10:00:00.000Z";

/**
 * Build SnapshotInputs with a life-evidence ref pointing to moltbook (fallback-supported platform).
 * moltbook supports "feed.read" which maps to the "exploration" intent kind.
 * This ensures planner can resolve platformId and produces sourceRefs for the intent,
 * allowing the source-backed guard to pass.
 */
function makeSnapshotInputs(overrides: Partial<SnapshotInputs> = {}): SnapshotInputs {
  return {
    mode: "active",
    currentWindowId: "w1",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    budgets: { socialUsed: 0, socialLimit: 5 },
    awaitingUserInput: false,
    riskSuppressed: false,
    quietEnabledBridge: false,
    duplicateIntentKeys: [],
    outreachCooldownKeys: [],
    // Provide a platform://moltbook/feed.read evidence ref so planner emits
    // a moltbook exploration intent with non-empty sourceRefs, satisfying the
    // source-backed guard (isSourceBacked) and resolving platformId.
    lifeEvidenceRefs: [
      {
        id: "ev:moltbook:feed:1",
        kind: "connector_result",
        uri: "platform://moltbook/feed.read",
        observedAt: TEST_TIMESTAMP,
      },
    ],
    ...overrides,
  };
}

function makeSignal(): HeartbeatSignal {
  return {
    trigger: "heartbeat_bridge",
    scopeHint: "rhythm",
    payload: { timestamp: TEST_TIMESTAMP },
  };
}

function makeConnectorResult(
  status: ConnectorResult<unknown>["status"],
  failureClass?: import("../../../src/connectors/base/failure-taxonomy.js").FailureClass,
): ConnectorResult<unknown> {
  return {
    status,
    failureClass,
    metadata: { platformId: "moltbook", channel: "api_rest", latencyMs: 42 },
  };
}

/**
 * Build a connector_action CandidateIntent suitable for guard-layer tests.
 * Uses moltbook which is in the fallback platform list.
 */
function makeConnectorIntent(
  platformId: string,
  capabilityId: string,
  overrides: Partial<CandidateIntent> = {},
): CandidateIntent {
  return {
    id: `intent:${platformId}:${capabilityId}`,
    kind: "exploration",
    summary: `scan platform opportunities on ${platformId}`,
    effectClass: "connector_action",
    platformId,
    capabilityIntent: capabilityId,
    sourceRefs: [
      {
        id: `ev:${platformId}:feed:1`,
        kind: "connector_result",
        uri: `platform://${platformId}/feed.read`,
        observedAt: TEST_TIMESTAMP,
      },
    ],
    idempotencyKey: `exploration:${platformId}`,
    goalInfluenceRefs: [],
    priority: 70,
    source: "tick",
    ...overrides,
  } as CandidateIntent;
}

// ─── Tests: heartbeat loop + experienceWriter ───────────────────────────────

describe("T-V7C.C.2 — Evidence + Body Feedback Closure", () => {
  it("heartbeat connector success writes ToolExperience with triggerSource=heartbeat", async () => {
    const recorded: Array<{ connectorId: string; capabilityId: string; triggerSource: string; status: string }> = [];
    const mockExperienceWriter: ExperienceWriter = {
      async recordExperience(input) {
        recorded.push({
          connectorId: input.connectorId,
          capabilityId: input.capabilityId,
          triggerSource: input.triggerSource,
          status: input.result.status,
        });
      },
    };

    const signal = makeSignal();
    const deps: HeartbeatDeps = {
      loadSnapshotInputs: async () => makeSnapshotInputs(),
      connectorExecutor: {
        async executeEffect() {
          return makeConnectorResult("success");
        },
      },
      experienceWriter: mockExperienceWriter,
    };

    const result = await ingestRhythmSignal(signal, deps);
    assert.strictEqual(result.status, "intent_selected", `expected intent_selected, got ${result.status} — reasons: ${result.reasons?.join(", ")}`);
    assert.strictEqual(recorded.length, 1, `expected 1 ToolExperience record, got ${recorded.length}`);
    assert.strictEqual(recorded[0]!.triggerSource, "heartbeat");
    assert.strictEqual(recorded[0]!.status, "success");
    // platformId resolved to moltbook by the evidence ref
    assert.strictEqual(recorded[0]!.connectorId, "moltbook");
  });

  it("heartbeat connector failure also writes ToolExperience with triggerSource=heartbeat", async () => {
    const recorded: Array<{ triggerSource: string; status: string; failureClass?: string }> = [];
    const mockExperienceWriter: ExperienceWriter = {
      async recordExperience(input) {
        recorded.push({
          triggerSource: input.triggerSource,
          status: input.result.status,
          failureClass: input.result.failureClass,
        });
      },
    };

    const signal = makeSignal();
    const deps: HeartbeatDeps = {
      loadSnapshotInputs: async () => makeSnapshotInputs(),
      connectorExecutor: {
        async executeEffect() {
          return makeConnectorResult("terminal_failure", "transport_failure");
        },
      },
      experienceWriter: mockExperienceWriter,
    };

    const result = await ingestRhythmSignal(signal, deps);
    assert.strictEqual(result.status, "intent_selected", `expected intent_selected, got ${result.status} — reasons: ${result.reasons?.join(", ")}`);
    assert.strictEqual(recorded.length, 1, `expected 1 ToolExperience record, got ${recorded.length}`);
    assert.strictEqual(recorded[0]!.triggerSource, "heartbeat");
    assert.strictEqual(recorded[0]!.status, "terminal_failure");
    assert.strictEqual(recorded[0]!.failureClass, "transport_failure");
  });

  // ─── Tests: guard-layer affordance/breaker (direct evaluateHardGuards) ────

  it("guard-layer defers connector_action when affordance status is painful (circuit open)", () => {
    const painfulAffordanceMap: AffordanceMap = {
      "moltbook": [
        {
          platformId: "moltbook",
          capabilityId: "feed.read",
          intent: "scan platform opportunities on moltbook",
          status: "painful",
          reason: "breaker:open",
        },
      ],
    };

    const inputs = makeSnapshotInputs({ affordanceMap: painfulAffordanceMap });
    const continuity = buildContinuitySnapshot(inputs);
    const runtime = buildHeartbeatRuntimeSnapshot(TEST_TIMESTAMP, inputs, continuity);
    const intent = makeConnectorIntent("moltbook", "feed.read");

    const evaluation = evaluateHardGuards(intent, runtime);
    assert.strictEqual(evaluation.verdict, "defer", `expected defer, got ${evaluation.verdict}`);
    assert.ok(
      evaluation.reasons.some((r) => r.includes("connector_circuit_open")),
      `expected connector_circuit_open in reasons, got: ${evaluation.reasons.join(", ")}`,
    );
  });

  it("guard-layer defers connector_action when affordance status is unavailable", () => {
    const unavailableAffordanceMap: AffordanceMap = {
      "moltbook": [
        {
          platformId: "moltbook",
          capabilityId: "feed.read",
          intent: "scan platform opportunities on moltbook",
          status: "unavailable",
          reason: "probe:unavailable",
        },
      ],
    };

    const inputs = makeSnapshotInputs({ affordanceMap: unavailableAffordanceMap });
    const continuity = buildContinuitySnapshot(inputs);
    const runtime = buildHeartbeatRuntimeSnapshot(TEST_TIMESTAMP, inputs, continuity);
    const intent = makeConnectorIntent("moltbook", "feed.read");

    const evaluation = evaluateHardGuards(intent, runtime);
    assert.strictEqual(evaluation.verdict, "defer", `expected defer, got ${evaluation.verdict}`);
    assert.ok(
      evaluation.reasons.some((r) => r.includes("affordance_unavailable")),
      `expected affordance_unavailable in reasons, got: ${evaluation.reasons.join(", ")}`,
    );
  });

  it("guard-layer allows connector_action when affordance status is safe", () => {
    const safeAffordanceMap: AffordanceMap = {
      "moltbook": [
        {
          platformId: "moltbook",
          capabilityId: "feed.read",
          intent: "scan platform opportunities on moltbook",
          status: "safe",
          reason: "probe:available",
        },
      ],
    };

    const inputs = makeSnapshotInputs({ affordanceMap: safeAffordanceMap });
    const continuity = buildContinuitySnapshot(inputs);
    const runtime = buildHeartbeatRuntimeSnapshot(TEST_TIMESTAMP, inputs, continuity);
    const intent = makeConnectorIntent("moltbook", "feed.read");

    const evaluation = evaluateHardGuards(intent, runtime);
    assert.strictEqual(evaluation.verdict, "allow", `expected allow, got ${evaluation.verdict} — reasons: ${evaluation.reasons.join(", ")}`);
  });
});
