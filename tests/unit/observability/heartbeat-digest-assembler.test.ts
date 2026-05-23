/**
 * Tests for HeartbeatDigestAssembler — T-OBS.C.3
 *
 * Covers:
 * - connector attempts aggregated per platform+capability
 * - success/failure/blocked/circuit-open counts correct
 * - no events → isNothingSignificant=true
 * - goal transitions from state-memory port
 * - quiet/dream status from state-memory port
 * - DR-032: state-memory unavailable → goalSummary + quietDreamSummary degraded
 * - digest content does not contain raw payload/credential
 * - delivery counts in healthSummary
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import {
  buildAuditEnvelope,
  type AuditEventFamily,
} from "../../../src/observability/audit/audit-envelope.js";
import {
  generateHeartbeatDigest,
  type StateMemoryDigestPort,
  type HeartbeatDigestAssemblerDeps,
} from "../../../src/observability/services/heartbeat-digest-assembler.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = "2026-05-23";
const TODAY_TS = `${TODAY}T10:00:00.000Z`;

function makeStore(): AppendOnlyAuditStore {
  return new AppendOnlyAuditStore();
}

let _seq = 0;

function appendEvent(
  store: AppendOnlyAuditStore,
  family: AuditEventFamily,
  payload: Record<string, unknown>,
  createdAt: string = TODAY_TS,
): void {
  const previousHash = store.lastRecordHash(family);
  const envelope = buildAuditEnvelope({
    family,
    plane: "telemetry",
    traceId: `trace-${Math.random().toString(36).slice(2)}`,
    sequence: ++_seq,
    payload,
    previousHash,
  });
  // Override createdAt for test control
  (envelope as unknown as Record<string, unknown>).createdAt = createdAt;
  store.append(envelope);
}

function makeStateMemoryPort(
  goals?: Partial<{
    newGoals: number;
    completedGoals: number;
    expiredGoals: number;
    replacedGoals: number;
    activeGoals: number;
  }>,
  quietDream?: Partial<{
    quietRuns: number;
    quietSucceeded: number;
    dreamRuns: number;
    dreamAccepted: number;
    dreamSkipped: number;
    dreamSkipReasons: string[];
  }>,
): StateMemoryDigestPort {
  return {
    queryGoalTransitions: async () => ({
      newGoals: goals?.newGoals ?? 0,
      completedGoals: goals?.completedGoals ?? 0,
      expiredGoals: goals?.expiredGoals ?? 0,
      replacedGoals: goals?.replacedGoals ?? 0,
      activeGoals: goals?.activeGoals ?? 1,
    }),
    queryQuietDreamStatus: async () => ({
      quietRuns: quietDream?.quietRuns ?? 0,
      quietSucceeded: quietDream?.quietSucceeded ?? 0,
      dreamRuns: quietDream?.dreamRuns ?? 0,
      dreamAccepted: quietDream?.dreamAccepted ?? 0,
      dreamSkipped: quietDream?.dreamSkipped ?? 0,
      dreamSkipReasons: quietDream?.dreamSkipReasons ?? [],
    }),
  };
}

function makeDeps(
  store: AppendOnlyAuditStore,
  port?: StateMemoryDigestPort,
): HeartbeatDigestAssemblerDeps {
  return { auditStore: store, stateMemoryPort: port };
}

// ─── connector summary ────────────────────────────────────────────────────────

describe("generateHeartbeatDigest — connector summary", () => {
  it("aggregates success/failure/circuit-open/blocked per platform+capability", async () => {
    const store = makeStore();

    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" });
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" });
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "failure" });
    appendEvent(store, "connector.attempt", { platformId: "instreet",  capability: "post.write", outcome: "circuit_open" });
    appendEvent(store, "connector.attempt", { platformId: "instreet",  capability: "post.write", outcome: "blocked" });

    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));

    const moltbook = digest.connectorSummary.find(
      (c) => c.platformId === "moltbook" && c.capability === "feed.read",
    );
    assert.ok(moltbook, "moltbook feed.read not found");
    assert.equal(moltbook.successCount, 2);
    assert.equal(moltbook.failureCount, 1);
    assert.equal(moltbook.circuitOpenCount, 0);
    assert.equal(moltbook.blockedCount, 0);

    const instreet = digest.connectorSummary.find(
      (c) => c.platformId === "instreet" && c.capability === "post.write",
    );
    assert.ok(instreet, "instreet post.write not found");
    assert.equal(instreet.circuitOpenCount, 1);
    assert.equal(instreet.blockedCount, 1);
  });

  it("connector events from different dates are not counted", async () => {
    const store = makeStore();
    const yesterday = "2026-05-22T10:00:00.000Z";
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" }, yesterday);

    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    assert.equal(digest.connectorSummary.length, 0);
  });

  it("multiple capabilities of same platform appear as separate entries", async () => {
    const store = makeStore();
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" });
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "post.write", outcome: "failure" });

    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    assert.equal(digest.connectorSummary.length, 2);
  });
});

// ─── isNothingSignificant ─────────────────────────────────────────────────────

describe("generateHeartbeatDigest — isNothingSignificant", () => {
  it("returns isNothingSignificant=true when no events", async () => {
    const store = makeStore();
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    assert.equal(digest.isNothingSignificant, true);
  });

  it("returns isNothingSignificant=false when connector activity exists", async () => {
    const store = makeStore();
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" });
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    assert.equal(digest.isNothingSignificant, false);
  });

  it("does not fabricate activity — nothing_significant is honest", async () => {
    const store = makeStore();
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    // connectorSummary should be empty
    assert.equal(digest.connectorSummary.length, 0);
    // healthSummary delivery counts should be 0
    assert.equal(digest.healthSummary.deliverySuccessCount, 0);
    assert.equal(digest.healthSummary.deliveryFailureCount, 0);
    assert.equal(digest.isNothingSignificant, true);
  });
});

// ─── goal transitions from port ───────────────────────────────────────────────

describe("generateHeartbeatDigest — goal transitions", () => {
  it("reads goal transitions from state-memory port", async () => {
    const store = makeStore();
    const port = makeStateMemoryPort({ newGoals: 2, completedGoals: 1, activeGoals: 3 });
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store, port));

    assert.equal(digest.goalSummary.newGoals, 2);
    assert.equal(digest.goalSummary.completedGoals, 1);
    assert.equal(digest.goalSummary.activeGoals, 3);
  });

  it("goal activity makes isNothingSignificant=false", async () => {
    const store = makeStore();
    const port = makeStateMemoryPort({ newGoals: 1 });
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store, port));
    assert.equal(digest.isNothingSignificant, false);
  });
});

// ─── DR-032: state-memory unavailable ─────────────────────────────────────────

describe("generateHeartbeatDigest — DR-032 state-memory degraded", () => {
  it("goalSummary degraded when state-memory port throws", async () => {
    const store = makeStore();
    const failingPort: StateMemoryDigestPort = {
      queryGoalTransitions: async () => { throw new Error("db_connection_failed"); },
      queryQuietDreamStatus: async () => ({ quietRuns: 0, quietSucceeded: 0, dreamRuns: 0, dreamAccepted: 0, dreamSkipped: 0, dreamSkipReasons: [] }),
    };
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store, failingPort));

    assert.equal(digest.goalSummary.degraded, true);
    assert.equal(digest.goalSummary.degradedReason, "state_memory_unavailable");
  });

  it("quietDreamSummary degraded when state-memory port throws", async () => {
    const store = makeStore();
    const failingPort: StateMemoryDigestPort = {
      queryGoalTransitions: async () => ({ newGoals: 0, completedGoals: 0, expiredGoals: 0, replacedGoals: 0, activeGoals: 0 }),
      queryQuietDreamStatus: async () => { throw new Error("db_unavailable"); },
    };
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store, failingPort));

    assert.equal(digest.quietDreamSummary.degraded, true);
    assert.equal(digest.quietDreamSummary.degradedReason, "state_memory_unavailable");
  });

  it("connector summary unaffected by state-memory failure", async () => {
    const store = makeStore();
    appendEvent(store, "connector.attempt", { platformId: "moltbook", capability: "feed.read", outcome: "success" });

    const failingPort: StateMemoryDigestPort = {
      queryGoalTransitions: async () => { throw new Error("unavailable"); },
      queryQuietDreamStatus: async () => { throw new Error("unavailable"); },
    };
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store, failingPort));

    assert.equal(digest.connectorSummary.length, 1);
    assert.equal(digest.connectorSummary[0].successCount, 1);
  });
});

// ─── healthSummary ────────────────────────────────────────────────────────────

describe("generateHeartbeatDigest — healthSummary", () => {
  it("counts delivery success and failure from audit events", async () => {
    const store = makeStore();
    appendEvent(store, "delivery", { outcome: "sent" });
    appendEvent(store, "delivery", { outcome: "sent" });
    appendEvent(store, "delivery", { outcome: "failed" });
    appendEvent(store, "delivery", { outcome: "not_sent" });

    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    assert.equal(digest.healthSummary.deliverySuccessCount, 2);
    assert.equal(digest.healthSummary.deliveryFailureCount, 2);
  });
});

// ─── digest content safety ───────────────────────────────────────────────────

describe("generateHeartbeatDigest — content safety", () => {
  it("digest does not expose raw payload fields", async () => {
    const store = makeStore();
    appendEvent(store, "connector.attempt", {
      platformId: "moltbook",
      capability: "feed.read",
      outcome: "success",
      rawPayload: "SENSITIVE_RAW_DATA", // should not appear in digest
      credential: "secret-token",       // should not appear in digest
    });

    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    const json = JSON.stringify(digest);

    assert.ok(!json.includes("SENSITIVE_RAW_DATA"), "raw payload leaked into digest");
    assert.ok(!json.includes("secret-token"), "credential leaked into digest");
  });

  it("digest does not contain outreach-style language", async () => {
    const store = makeStore();
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));
    const json = JSON.stringify(digest);

    // Dashboard-style: should not say "reaching out" or "let's connect"
    assert.ok(!json.toLowerCase().includes("reaching out"));
    assert.ok(!json.toLowerCase().includes("let's connect"));
    assert.ok(!json.toLowerCase().includes("just checking"));
  });
});

// ─── dream trace in audit ─────────────────────────────────────────────────────

describe("generateHeartbeatDigest — dream trace from audit", () => {
  it("counts dream runs and accepted from dream.trace events", async () => {
    const store = makeStore();
    appendEvent(store, "dream.trace", { event: "dream_started" });
    appendEvent(store, "dream.trace", { event: "dream_started" });
    appendEvent(store, "dream.trace", { event: "dream_accepted" });
    appendEvent(store, "dream.trace", { event: "dream_skipped", skipReason: "lock_held" });

    // No state-memory port → use audit-based aggregation
    const digest = await generateHeartbeatDigest(TODAY, makeDeps(store));

    assert.equal(digest.quietDreamSummary.dreamRuns, 2);
    assert.equal(digest.quietDreamSummary.dreamAccepted, 1);
    assert.equal(digest.quietDreamSummary.dreamSkipped, 1);
    assert.ok(digest.quietDreamSummary.dreamSkipReasons.includes("lock_held"));
  });
});
