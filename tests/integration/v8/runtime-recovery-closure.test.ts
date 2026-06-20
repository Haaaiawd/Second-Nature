/**
 * Runtime Recovery Closure Gate — Integration Test (INT-R3 / Wave 108)
 *
 * Validates: Wave 108 repairs restore the PRD living loop path from heartbeat
 * closure into Quiet/Dream, while connector failures and repeated denials are
 * truthful, bounded, and operator-actionable.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeEvidenceItem,
  writeActionClosureRecord,
  readActionClosuresByCycle,
  readDailyRhythmStateByDay,
  readQuietDailyReviewById,
} from "../../../src/storage/v8-state-stores.js";
import { runHeartbeatCycle } from "../../../src/core/second-nature/control-plane/heartbeat-orchestrator.js";
import { readLoopStatus } from "../../../src/observability/loop-status.js";
import {
  CapabilityContractRegistry,
  ChannelHealthStore,
  ConnectorRoutePlanner,
  createConnectorPolicyLayer,
  type CapabilityIntent,
  type ConnectorRequest,
  type RouteContextPort,
} from "../../../src/connectors/base/index.js";
import { createConnectorCooldownPort } from "../../../src/connectors/services/connector-cooldown-port.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

function makeRef(id: string, family: import("../../../src/shared/types/v8-contracts.js").SourceRefFamily = "evidence"): SourceRef {
  return {
    uri: `sn://${family}/${id}`,
    family,
    id,
    redactionClass: "none",
    resolveStatus: "resolvable",
  };
}

function makeRouteContext(): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      return {
        platformId,
        status: "active" as const,
        credentialType: "api_key",
        encryptedValue: "api-key",
      };
    },
    async loadCooldownState() {
      return { blocked: false };
    },
  };
}

function makeConnectorRequest(intent: CapabilityIntent, overrides: Partial<ConnectorRequest> = {}): ConnectorRequest {
  return {
    platformId: "moltbook",
    intent,
    payload: {},
    decisionId: "dec_001",
    intentId: "int_001",
    idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

function makeClosure(day: string, overrides: Record<string, unknown>) {
  return {
    id: `closure_${day}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    cycleId: `cycle_${day}`,
    status: "denied" as const,
    closureStatus: "denied" as const,
    inputSummary: "test",
    outputSummary: "done",
    postProcessing: [],
    nextState: "ok",
    reason: "policy_denied_high_risk",
    platformId: "heartbeat",
    capabilityId: undefined,
    sourceRefs: [
      { uri: "sn://test", family: "action_closure" as const, id: "c1", redactionClass: "none" as const, resolveStatus: "resolvable" as const },
    ],
    createdAt: `${day}T12:00:00Z`,
    closedAt: `${day}T12:00:00Z`,
    dispatchAttempt: 1,
    ...overrides,
  };
}

async function runPolicyWithStatus(db: ReturnType<typeof createStateDatabase>, status: number) {
  const registry = new CapabilityContractRegistry();
  registry.register({
    platformId: "moltbook",
    supportedCapabilities: ["feed.read"],
    channelPriority: ["api_rest"],
    credentialTypes: ["api_key"],
  });

  const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
  const policy = createConnectorPolicyLayer({
    routePlanner,
    retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
    executionRunner: {
      async run() {
        return {
          platformId: "moltbook",
          channel: "api_rest" as const,
          latencyMs: 10,
          success: false,
          error: { code: "api_error", status, detail: "simulated" },
        };
      },
    },
  });

  return policy.executeWithPolicy("feed.read", makeConnectorRequest("feed.read"));
}

describe("runtime-recovery-closure", () => {
  it("heartbeat closure advances into Quiet/Dream rhythm", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      await writeEvidenceItem(db, {
        id: "ev_int_r3_001",
        createdAt: now,
        platformId: "moltbook",
        contentHash: "hash_int_r3_001",
        observedAt: now,
        sourceRefs: [makeRef("ev_int_r3_001")],
        redactionClass: "none",
        lifecycleStatus: "pending",
      });

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      assert.ok(!("status" in result), "heartbeat should not degrade");
      const r = result as { cycleId: string; rhythmState?: { quietStatus: string; dreamStatus: string } };

      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "exactly one closure");

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(!rhythm.degraded, "rhythm read should not degrade");
      assert.ok(rhythm.row, "rhythm state exists");
      assert.equal(rhythm.row?.quietStatus, "completed");
      assert.equal(rhythm.row?.dreamStatus, "completed");

      const quiet = await readQuietDailyReviewById(db, `quiet_${day}`);
      assert.ok(!quiet.degraded, "quiet read should not degrade");
      assert.ok(quiet.row, "quiet daily review exists");
      assert.ok((quiet.row?.closureRefsJson ?? "[]").includes("sn://closure"), "quiet review has closure refs");

      assert.ok(r.rhythmState, "result carries rhythm state");
      assert.equal(r.rhythmState?.quietStatus, "completed");
      assert.equal(r.rhythmState?.dreamStatus, "completed");
    } finally {
      db.close();
    }
  });

  it("no-action heartbeat still advances daily rhythm", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);

      const result = await runHeartbeatCycle(db, {
        workspaceRoot: "/test",
        requestedAt: now,
        trigger: "manual",
      });

      assert.ok(!("status" in result), "heartbeat should not degrade");
      const r = result as { cycleId: string; rhythmState?: { quietStatus: string; dreamStatus: string } };

      const closures = await readActionClosuresByCycle(db, r.cycleId);
      assert.equal(closures.rows.length, 1, "no-action closure written");

      const rhythm = await readDailyRhythmStateByDay(db, day);
      assert.ok(rhythm.row, "rhythm state exists after no-action closure");
      assert.equal(rhythm.row?.quietStatus, "completed");
      assert.equal(rhythm.row?.dreamStatus, "completed");

      const quiet = await readQuietDailyReviewById(db, `quiet_${day}`);
      assert.ok(quiet.row, "quiet review exists even without evidence");
    } finally {
      db.close();
    }
  });

  it("connector policy layer classifies 401 as auth_failure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runPolicyWithStatus(db, 401);
      assert.equal(result.status, "terminal_failure");
      if (result.status !== "terminal_failure") return;
      assert.equal(result.failureClass, "auth_failure");
    } finally {
      db.close();
    }
  });

  it("connector policy layer classifies 404 as permanent_input_error", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runPolicyWithStatus(db, 404);
      assert.equal(result.status, "terminal_failure");
      if (result.status !== "terminal_failure") return;
      assert.equal(result.failureClass, "permanent_input_error");
    } finally {
      db.close();
    }
  });

  it("connector policy layer classifies 429 as rate_limited", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runPolicyWithStatus(db, 429);
      assert.equal(result.status, "terminal_failure");
      if (result.status !== "terminal_failure") return;
      assert.equal(result.failureClass, "rate_limited");
    } finally {
      db.close();
    }
  });

  it("connector policy layer classifies 503 as transport_failure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runPolicyWithStatus(db, 503);
      assert.equal(result.status, "terminal_failure");
      if (result.status !== "terminal_failure") return;
      assert.equal(result.failureClass, "transport_failure");
    } finally {
      db.close();
    }
  });

  it("connector policy layer classifies unlisted 5xx as transport_failure", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await runPolicyWithStatus(db, 505);
      assert.equal(result.status, "terminal_failure");
      if (result.status !== "terminal_failure") return;
      assert.equal(result.failureClass, "transport_failure");
    } finally {
      db.close();
    }
  });

  it("connector cooldown bounds replay after terminal failures", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = new CapabilityContractRegistry();
      registry.register({
        platformId: "moltbook",
        supportedCapabilities: ["feed.read"],
        channelPriority: ["api_rest"],
        credentialTypes: ["api_key"],
      });

      const cooldownPort = createConnectorCooldownPort(db);
      const routePlanner = new ConnectorRoutePlanner(registry, makeRouteContext(), new ChannelHealthStore());
      let callCount = 0;
      const policy = createConnectorPolicyLayer({
        routePlanner,
        cooldownPort,
        retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1, jitter: false },
        executionRunner: {
          async run() {
            callCount += 1;
            return {
              platformId: "moltbook",
              channel: "api_rest" as const,
              latencyMs: 10,
              success: false,
              error: { code: "api_error", status: 401, detail: "Unauthorized" },
            };
          },
        },
      });

      const r1 = await policy.executeWithPolicy("feed.read", makeConnectorRequest("feed.read"));
      assert.equal(r1.status, "terminal_failure");
      assert.equal(r1.failureClass, "auth_failure");

      const r2 = await policy.executeWithPolicy("feed.read", makeConnectorRequest("feed.read"));
      assert.equal(r2.status, "terminal_failure");
      assert.equal(r2.failureClass, "auth_failure");

      const r3 = await policy.executeWithPolicy("feed.read", makeConnectorRequest("feed.read"));
      assert.equal(r3.status, "terminal_failure");
      assert.equal(r3.failureClass, "cooldown_blocked");
      assert.equal(callCount, 2, "runner not invoked while cooldown active");
    } finally {
      db.close();
    }
  });

  it("loop_status attributes denials and replays without credential leak", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const day = new Date().toISOString().slice(0, 10);

      await writeActionClosureRecord(db, makeClosure(day, { status: "denied", closureStatus: "denied", reason: "policy_denied_high_risk" }));
      await writeActionClosureRecord(db, makeClosure(day, { status: "denied", closureStatus: "denied", reason: "source_refs_missing" }));
      await writeActionClosureRecord(db, makeClosure(day, { status: "downgraded", closureStatus: "downgraded", reason: "cooldown_blocked" }));
      await writeActionClosureRecord(db, makeClosure(day, { status: "no_action", closureStatus: "no_action", reason: "evidence_batch_empty" }));
      await writeActionClosureRecord(db, makeClosure(day, { status: "downgraded", closureStatus: "downgraded", reason: "guidance_unavailable" }));
      await writeActionClosureRecord(db, makeClosure(day, { status: "denied", closureStatus: "denied", reason: "auth_failure" }));

      const result = await readLoopStatus(db);
      assert.equal(result.ok, true);
      if (!result.ok) return;

      assert.equal(result.status.policyDeniedCount, 1);
      assert.equal(result.status.hardGuardDeniedCount, 1);
      assert.equal(result.status.cooldownReplayCount, 1);
      assert.equal(result.status.sourceAbsenceCount, 1);
      assert.equal(result.status.quietSuppressionCount, 1);
      assert.equal(result.status.connectorTerminalCount, 1);

      const statusJson = JSON.stringify(result.status);
      assert.ok(!statusJson.includes("api-key"), "no api-key leak");
      assert.ok(!statusJson.includes("token"), "no token leak");
      assert.ok(!result.status.nextAction.includes("governance"), "does not blame generic governance");
    } finally {
      db.close();
    }
  });
});
