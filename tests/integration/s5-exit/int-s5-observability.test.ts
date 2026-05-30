/**
 * INT-S5 — S5 Observability 集成冒烟测试
 *
 * Exit criteria verification (05A_TASKS.md INT-S5):
 *
 * 1. Audit chain integrity verifiable — AppendOnlyAuditStore per-family hash chain
 *    links correctly; chain corruption is detected and marked degraded.
 * 2. SelfHealthSnapshot covers dynamic dimensions and minimum dimension set is
 *    complete; any single probe timeout does not affect overall snapshot.
 * 3. HeartbeatDigest per-platform counts correct; nothing_significant on empty day.
 * 4. NarrativeTimeline cursor pagination normal; 90-day range enforced.
 * 5. RestoreAudit writes on every attempt; partial_restore_error records entity lists.
 * 6. RuntimeSecretAnchorView returns recoverySteps for all three reason codes.
 *
 * Evidence: reports/int-s5-observability-v7.md
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Audit chain (T-OBS.C.1)
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { buildAuditEnvelope } from "../../../src/observability/audit/audit-envelope.js";
import { verifyAuditHashChain } from "../../../src/observability/audit/verify-audit-hash-chain.js";

// SelfHealthSnapshot (T-OBS.C.2)
import {
  getSelfHealthSnapshot,
  registerHealthProbe,
  unregisterHealthProbe,
  clearHealthProbeRegistry,
  ensureMinimumProbes,
  MINIMUM_REQUIRED_DIMENSIONS,
  type DimensionHealth,
  type RegisteredProbe,
} from "../../../src/observability/services/self-health-snapshot.js";

// HeartbeatDigest (T-OBS.C.3 + T-OBS.C.4)
import {
  generateHeartbeatDigest,
  type HeartbeatDigestAssemblerDeps,
  type ConnectorDaySummary,
} from "../../../src/observability/services/heartbeat-digest-assembler.js";

// NarrativeTimeline (T-OBS.C.5)
import {
  queryNarrativeTimeline,
  queryNarrativeDiff,
  NarrativeQueryRangeError,
  type NarrativeTimelineRow,
  type NarrativeSnapshotRow,
  type NarrativeTimelineDeps,
} from "../../../src/observability/services/narrative-timeline-query-service.js";

// RestoreAudit (T-OBS.C.6)
import {
  writeRestoreAudit,
} from "../../../src/observability/services/restore-audit-service.js";

// RuntimeSecretAnchorView (T-OBS.C.7)
import {
  viewSecretAnchor,
  type SecretAnchorDeps,
} from "../../../src/observability/services/runtime-secret-anchor-view.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuditEnvelope(family: string, seq: number, previousHash?: string) {
  const payload = { seq, msg: `event-${seq}` };
  return buildAuditEnvelope({
    family: family as Parameters<typeof buildAuditEnvelope>[0]["family"],
    plane: "governance",
    traceId: `trace-int-s5-${seq}`,
    sequence: seq,
    payload,
    previousHash,
  });
}

function makeDimHealth(status: "healthy" | "degraded" | "unknown"): DimensionHealth {
  return { status, checkedAt: new Date().toISOString() };
}

// ─── 1. Audit chain integrity (T-OBS.C.1) ────────────────────────────────────

describe("INT-S5 #1: audit chain integrity (T-OBS.C.1)", () => {
  it("per-family hash chain links correctly across 5 events", () => {
    const store = new AppendOnlyAuditStore();
    let prevHash: string | undefined;
    for (let i = 1; i <= 5; i++) {
      const env = makeAuditEnvelope("restore.audit", i, prevHash);
      store.append(env);
      prevHash = env.integrity.recordHash;
    }
    assert.strictEqual(store.list().length, 5);
    // lastRecordHash returns correct per-family hash
    assert.strictEqual(store.lastRecordHash("restore.audit"), prevHash);
  });

  it("detects chain corruption: previousHash mismatch throws", () => {
    const store = new AppendOnlyAuditStore();
    const env1 = makeAuditEnvelope("health.probe", 1, undefined);
    store.append(env1);
    // Craft a broken second event with wrong previousHash
    const brokenEnv = makeAuditEnvelope("health.probe", 2, "wrong-hash-0000");
    assert.throws(() => store.append(brokenEnv), /audit_previous_hash_mismatch/);
  });

  it("seedFamilyHash enables backfill after process restart", () => {
    const store = new AppendOnlyAuditStore();
    const simulatedDbHash = "restart-backfill-hash-abc123";
    store.seedFamilyHash("narrative.snapshot", simulatedDbHash);
    // Next event must link to the seeded hash
    const env = makeAuditEnvelope("narrative.snapshot", 1, simulatedDbHash);
    assert.doesNotThrow(() => store.append(env));
  });

  it("two families maintain independent chains", () => {
    const store = new AppendOnlyAuditStore();
    const e1 = makeAuditEnvelope("restore.audit", 1, undefined);
    const e2 = makeAuditEnvelope("health.probe", 1, undefined);
    store.append(e1);
    store.append(e2);
    assert.strictEqual(store.lastRecordHash("restore.audit"), e1.integrity.recordHash);
    assert.strictEqual(store.lastRecordHash("health.probe"), e2.integrity.recordHash);
  });
});

// ─── 2. SelfHealthSnapshot dimensions (T-OBS.C.2) ────────────────────────────

describe("INT-S5 #2: SelfHealthSnapshot minimum dimension set + probe isolation (T-OBS.C.2)", () => {
  beforeEach(() => {
    clearHealthProbeRegistry();
  });

  it("minimum required dimensions all present in snapshot", async () => {
    ensureMinimumProbes();
    const snap = await getSelfHealthSnapshot();
    for (const dimId of MINIMUM_REQUIRED_DIMENSIONS) {
      assert.ok(
        dimId in snap.dimensions,
        `Missing required dimension: ${dimId}`,
      );
    }
    assert.ok(snap.generatedAt, "generatedAt must be set");
    assert.ok(["healthy", "degraded", "unknown"].includes(snap.overall));
  });

  it("single probe timeout does not block overall snapshot", async () => {
    ensureMinimumProbes();
    // Register a slow probe that would time out
    const slowProbe: RegisteredProbe = {
      dimensionId: "slow_test_dim",
      probe: async () => {
        await new Promise((r) => setTimeout(r, 3500)); // > 3000ms total cap
        return makeDimHealth("healthy");
      },
      timeoutMs: 100,
    };
    registerHealthProbe(slowProbe);
    const snap = await getSelfHealthSnapshot();
    // slow_test_dim should be unknown/timeout; other dims should still be present
    const slowDim = snap.dimensions["slow_test_dim"];
    assert.ok(slowDim, "slow_test_dim should appear in snapshot");
    assert.notStrictEqual(slowDim.status, "healthy", "timed-out probe should not be healthy");
    // Minimum required dims still present
    for (const dimId of MINIMUM_REQUIRED_DIMENSIONS) {
      assert.ok(dimId in snap.dimensions, `Required dim ${dimId} missing after slow probe`);
    }
    unregisterHealthProbe("slow_test_dim");
  });

  it("dynamic probe registration works", async () => {
    ensureMinimumProbes();
    registerHealthProbe({ dimensionId: "custom_v7_dim", probe: async () => makeDimHealth("healthy"), timeoutMs: 500 });
    const snap = await getSelfHealthSnapshot();
    assert.ok("custom_v7_dim" in snap.dimensions);
    assert.strictEqual(snap.dimensions["custom_v7_dim"].status, "healthy");
  });
});

// ─── 3. HeartbeatDigest (T-OBS.C.3 + T-OBS.C.4) ─────────────────────────────

describe("INT-S5 #3: HeartbeatDigest per-platform counts + nothing_significant (T-OBS.C.3)", () => {
  const DATE = "2026-05-23";

  /**
   * Build a deps object with an audit store seeded with connector.attempt events
   * for the given platform/capability pairs.
   */
  function makeDeps(
    attempts: Array<{
      platformId: string;
      capability: string;
      outcome: "success" | "failure" | "circuit_open" | "blocked";
    }>,
  ): HeartbeatDigestAssemblerDeps {
    const store = new AppendOnlyAuditStore();
    let previousHash: string | undefined;
    attempts.forEach((a, idx) => {
      const env = buildAuditEnvelope({
        family: "connector.attempt",
        plane: "governance",
        traceId: `trace-hb-${idx}`,
        sequence: idx + 1,
        createdAt: `${DATE}T00:00:00.000Z`,
        payload: { platformId: a.platformId, capability: a.capability, outcome: a.outcome },
        previousHash,
      });
      store.append(env);
      previousHash = env.integrity.recordHash;
    });
    return { auditStore: store };
  }

  it("per-platform counts correct for connector attempts", async () => {
    const deps = makeDeps([
      { platformId: "moltbook", capability: "feed.read", outcome: "success" },
      { platformId: "moltbook", capability: "feed.read", outcome: "success" },
      { platformId: "moltbook", capability: "feed.read", outcome: "failure" },
      { platformId: "moltbook", capability: "feed.read", outcome: "circuit_open" },
      { platformId: "instreet",  capability: "post.publish", outcome: "blocked" },
    ]);
    const digest = await generateHeartbeatDigest(DATE, deps);
    assert.ok(Array.isArray(digest.connectorSummary), "connectorSummary must be array");
    const mb = digest.connectorSummary.find((s) => s.platformId === "moltbook");
    assert.ok(mb, "moltbook summary missing");
    assert.strictEqual(mb.successCount, 2);
    assert.strictEqual(mb.failureCount, 1);
    assert.strictEqual(mb.circuitOpenCount, 1);
    const is = digest.connectorSummary.find((s) => s.platformId === "instreet");
    assert.ok(is, "instreet summary missing");
    assert.strictEqual(is.blockedCount, 1);
  });

  it("nothing_significant on empty audit store", async () => {
    const store = new AppendOnlyAuditStore();
    const digest = await generateHeartbeatDigest(DATE, { auditStore: store });
    assert.strictEqual(
      digest.isNothingSignificant,
      true,
      "Empty day must set isNothingSignificant = true",
    );
    assert.strictEqual(digest.connectorSummary.length, 0, "no connector summaries fabricated");
  });

  it("digest does not contain credential / raw payload fields", async () => {
    const store = new AppendOnlyAuditStore();
    const digest = await generateHeartbeatDigest(DATE, { auditStore: store });
    const digestStr = JSON.stringify(digest);
    const forbidden = ["password", "raw_payload", "private_message", "Bearer "];
    for (const f of forbidden) {
      assert.ok(
        !digestStr.includes(f),
        `Digest must not contain forbidden field: ${f}`,
      );
    }
  });
});

// ─── 4. NarrativeTimeline cursor pagination (T-OBS.C.5) ──────────────────────

describe("INT-S5 #4: NarrativeTimeline cursor pagination + 90-day range (T-OBS.C.5)", () => {
  function makeRows(count: number): NarrativeTimelineRow[] {
    return Array.from({ length: count }, (_, i) => ({
      version: `v${i + 1}`,
      createdAt: new Date(Date.now() - (count - i) * 60000).toISOString(),
      triggerKind: "heartbeat.decision",
      sourceRefs: [`ref-${i}`],
      reasonCode: "ok",
      summaryText: `event ${i + 1}`,
    }));
  }

  function makeDeps(rows: NarrativeTimelineRow[]): NarrativeTimelineDeps {
    return {
      stateMemoryPort: {
        listNarrativeTimeline: async (_from, _to, opts) => {
          let filtered = rows;
          if (opts?.afterTimestamp) {
            filtered = rows.filter((r) => r.createdAt > opts.afterTimestamp!);
          }
          return filtered.slice(0, opts?.limit ?? 20);
        },
        getNarrativeSnapshot: async (version: string): Promise<NarrativeSnapshotRow | null> => {
          const idx = rows.findIndex((r) => r.version === version);
          if (idx === -1) return null;
          return {
            version,
            focus: `focus-${version}`,
            progress: `progress-${version}`,
            nextIntent: `intent-${version}`,
            sourceRefs: [`ref-${idx}`],
            lastChangeReasonCode: "ok",
          };
        },
      },
    };
  }

  it("cursor pagination returns correct pages", async () => {
    const rows = makeRows(25);
    const deps = makeDeps(rows);
    const from = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();

    const page1 = await queryNarrativeTimeline(from, to, { limit: 10 }, deps);
    assert.strictEqual(page1.entries.length, 10);
    assert.ok(page1.nextCursor, "page1 must have nextCursor");

    const page2 = await queryNarrativeTimeline(from, to, { limit: 10, cursor: page1.nextCursor }, deps);
    assert.ok(page2.entries.length > 0, "page2 must have entries");
    // No overlap
    const page1Versions = new Set(page1.entries.map((e) => e.version));
    for (const entry of page2.entries) {
      assert.ok(!page1Versions.has(entry.version), "Page overlap detected");
    }
  });

  it("90-day range exceeded throws NarrativeQueryRangeError", async () => {
    const rows = makeRows(5);
    const deps = makeDeps(rows);
    const from = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    await assert.rejects(
      () => queryNarrativeTimeline(from, to, {}, deps),
      NarrativeQueryRangeError,
    );
  });

  it("narrativeDiff returns field-level changes between two versions", async () => {
    const rows = makeRows(5);
    const deps = makeDeps(rows);
    const diff = await queryNarrativeDiff("v1", "v3", deps);
    assert.ok(diff, "diff result must be present");
    assert.ok("changes" in diff, "diff must have changes array");
  });
});

// ─── 5. RestoreAudit (T-OBS.C.6) ─────────────────────────────────────────────

describe("INT-S5 #5: RestoreAudit writes on every attempt + partial_restore_error (T-OBS.C.6)", () => {
  function makeEvent(overrides: Partial<Parameters<typeof writeRestoreAudit>[0]> = {}) {
    return {
      id: `evt-${Date.now()}`,
      restoreTarget: "goal" as const,
      fromVersion: "v1",
      toVersion: "v2",
      triggeredBy: "operator" as const,
      reason: "manual_rollback",
      completedEntities: ["goal", "narrative"],
      failedEntities: [] as string[],
      excludedFields: ["credential"],
      restoredFieldCount: 8,
      createdAt: new Date().toISOString(),
      traceId: `trace-${Date.now()}`,
      ...overrides,
    };
  }

  it("successful restore writes audit with from/to/reason", async () => {
    const store = new AppendOnlyAuditStore();
    const result = await writeRestoreAudit(makeEvent(), store);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(store.list().length, 1);
    const env = store.list()[0] as { payload: { fromVersion: string; toVersion: string; reason: string } };
    assert.strictEqual(env.payload.fromVersion, "v1");
    assert.strictEqual(env.payload.toVersion, "v2");
    assert.strictEqual(env.payload.reason, "manual_rollback");
  });

  it("partial_restore_error records completed and failed entity lists", async () => {
    const store = new AppendOnlyAuditStore();
    const result = await writeRestoreAudit(
      makeEvent({
        restoreTarget: "narrative",
        fromVersion: "v5",
        toVersion: "v4",
        triggeredBy: "agent",
        reason: "partial_restore_error",
        completedEntities: ["goal"],
        failedEntities: ["evidence", "relationship"],
        excludedFields: ["encryption_key"],
        restoredFieldCount: 3,
      }),
      store,
    );
    assert.strictEqual(result.ok, true);
    const env = store.list()[0] as {
      payload: { completedEntities: string[]; failedEntities: string[]; isPartialRestore: boolean };
    };
    assert.deepStrictEqual(env.payload.completedEntities, ["goal"]);
    assert.deepStrictEqual(env.payload.failedEntities, ["evidence", "relationship"]);
    // isPartialRestore is computed from failedEntities.length > 0
    assert.strictEqual(env.payload.isPartialRestore, true);
  });

  it("credential field value never written to audit (only field name in excludedFields)", async () => {
    const store = new AppendOnlyAuditStore();
    await writeRestoreAudit(
      makeEvent({
        reason: "credential_excluded_test",
        excludedFields: ["credential", "session_token"],
      }),
      store,
    );
    const rawAudit = JSON.stringify(store.list());
    assert.ok(rawAudit.includes("credential"), "excludedFields must list 'credential'");
    assert.ok(!rawAudit.includes("Bearer "), "credential values must not appear");
    assert.ok(!rawAudit.includes("sk-"), "credential values must not appear");
  });

  it("audit write failure is fire-and-forget (returns ok:true + warning)", async () => {
    // Simulate a store whose append() always throws (simulates DB write failure)
    const throwingStore = new AppendOnlyAuditStore();
    // Monkey-patch append to always throw after store is constructed
    (throwingStore as unknown as Record<string, unknown>)["append"] = () => {
      throw new Error("simulated_db_write_failure");
    };
    const result = await writeRestoreAudit(makeEvent({ reason: "fire_and_forget_test" }), throwingStore);
    assert.strictEqual(result.ok, true);
    assert.ok(result.warnings && result.warnings.length > 0, "warnings must be populated on audit failure");
    assert.ok(result.warnings[0].includes("simulated_db_write_failure"), "warning message should include original error");
  });
});

// ─── 6. RuntimeSecretAnchorView (T-OBS.C.7) ──────────────────────────────────

describe("INT-S5 #6: RuntimeSecretAnchorView three reason codes + recoverySteps (T-OBS.C.7)", () => {
  function makeOpsPort(overrides: {
    keyPath?: string;
    keyExists?: boolean;
  } = {}) {
    return {
      getEncryptionKeyPath: () => overrides.keyPath ?? "SECOND_NATURE_ENCRYPTION_KEY",
      checkKeyPathExists: async (_kp: string) => overrides.keyExists ?? true,
    };
  }

  function makeCredPort(sampleDecrypt: "ok" | "wrong_key" | "error") {
    return {
      verifySampleDecrypt: async () => {
        if (sampleDecrypt === "ok") return { status: "ok" as const, checkedIds: ["cred-1"] };
        if (sampleDecrypt === "wrong_key") return { status: "wrong_key" as const, checkedIds: ["cred-1"] };
        return { status: "error" as const, checkedIds: [] };
      },
    };
  }

  it("healthy anchor returns verified status", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: makeOpsPort(),
      credentialPort: makeCredPort("ok"),
    };
    const view = await viewSecretAnchor(deps);
    assert.strictEqual(view.status, "verified");
    assert.ok(!view.reasonCode, "verified status should have no reasonCode");
    assert.ok(Array.isArray(view.recoverySteps));
  });

  it("wrong key returns credential_recovery_required + recoverySteps", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: makeOpsPort(),
      credentialPort: makeCredPort("wrong_key"),
    };
    const view = await viewSecretAnchor(deps);
    assert.strictEqual(view.status, "wrong_key");
    assert.strictEqual(view.reasonCode, "credential_recovery_required");
    assert.ok(Array.isArray(view.recoverySteps) && view.recoverySteps.length > 0,
      "recoverySteps must be populated for credential_recovery_required");
  });

  it("decrypt error returns runtime_secret_unavailable + recoverySteps", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: makeOpsPort(),
      credentialPort: makeCredPort("error"),
    };
    const view = await viewSecretAnchor(deps);
    assert.strictEqual(view.reasonCode, "runtime_secret_unavailable");
    assert.ok(Array.isArray(view.recoverySteps) && view.recoverySteps.length > 0,
      "recoverySteps must be populated");
  });

  it("missing key path returns runtime_secret_anchor_missing", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: makeOpsPort({ keyExists: false }),
      credentialPort: makeCredPort("ok"),
    };
    const view = await viewSecretAnchor(deps);
    assert.strictEqual(view.status, "missing");
    assert.strictEqual(view.reasonCode, "runtime_secret_anchor_missing");
    assert.ok(Array.isArray(view.recoverySteps) && view.recoverySteps.length > 0);
  });

  it("anchor view never contains encryption key plaintext", async () => {
    const deps: SecretAnchorDeps = {
      runtimeOpsPort: makeOpsPort(),
      credentialPort: makeCredPort("wrong_key"),
    };
    const view = await viewSecretAnchor(deps);
    const viewStr = JSON.stringify(view);
    assert.ok(!viewStr.includes("sk-"), "key plaintext must not appear");
    assert.ok(!viewStr.includes("Bearer "), "credential value must not appear");
  });
});
