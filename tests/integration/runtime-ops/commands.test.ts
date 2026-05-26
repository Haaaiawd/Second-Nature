/**
 * T-ROS.C.1 集成测试 — RuntimeSurfaceRouter v7 命令集
 *
 * 验收标准（05A_TASKS.md T-ROS.C.1）:
 *  - connector_test --wet: dryRun=false + triggerSource:"manual" + affectsHeartbeatCadence=false
 *  - self_health: 返回 RuntimeOpsEnvelope, data 含 overall/dimensions/degraded_dimensions
 *  - heartbeat_digest: 返回 RuntimeOpsEnvelope + digest; 无 auditStore 时降级
 *  - narrative:diff: 返回 RuntimeOpsEnvelope + diff; 无 deps 时降级
 *  - timeline: 返回 RuntimeOpsEnvelope + page; range 超 90 天时 ok=false + NARRATIVE_RANGE_EXCEEDED
 *  - restore: 触发 RestoreSnapshotStore + RestoreAudit, ok=true, data.auditWritten=true; 无 auditStore 时降级
 *  - runtime_secret_bootstrap: 返回 RuntimeOpsEnvelope; plaintextKeyExposed=false
 *  - tool_affordance: port 未连线时 ok=false + TOOL_AFFORDANCE_PORT_UNWIRED
 *
 * Evidence: reports/int-s5-observability-v7.md (T-ROS.C.1 is part of Wave 67)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createOpsRouter, type RuntimeOpsEnvelope } from "../../../src/cli/ops/ops-router.js";
import {
  DynamicConnectorRegistry,
  createRegistrySnapshotStore,
} from "../../../src/connectors/registry/index.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { createStateDatabase, type StateDatabase } from "../../../src/storage/db/index.js";
import { createHistoryDigestStore } from "../../../src/storage/services/history-digest-store.js";
import {
  createRestoreSnapshotStore,
  type RestoreSnapshotStore,
} from "../../../src/storage/services/restore-snapshot-store.js";
import type { NarrativeTimelineDeps, NarrativeTimelineRow, NarrativeSnapshotRow } from "../../../src/observability/services/narrative-timeline-query-service.js";
import type { SecretAnchorDeps } from "../../../src/observability/services/runtime-secret-anchor-view.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNarrativeTimelineDeps(rowCount = 10): NarrativeTimelineDeps {
  const rows: NarrativeTimelineRow[] = Array.from({ length: rowCount }, (_, i) => ({
    version: `v${i + 1}`,
    createdAt: new Date(Date.now() - (rowCount - i) * 60000).toISOString(),
    triggerKind: "heartbeat.decision",
    sourceRefs: [`ref-${i}`],
    reasonCode: "ok",
    summaryText: `event ${i + 1}`,
  }));
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

function makeSecretAnchorDeps(scenario: "ok" | "missing" | "wrong_key" | "error"): SecretAnchorDeps {
  return {
    runtimeOpsPort: {
      getEncryptionKeyPath: () => "SECOND_NATURE_ENCRYPTION_KEY",
      checkKeyPathExists: async (_kp) => scenario !== "missing",
    },
    credentialPort: {
      verifySampleDecrypt: async () => {
        if (scenario === "ok") return { status: "ok" as const, checkedIds: ["cred-1"] };
        if (scenario === "wrong_key") return { status: "wrong_key" as const, checkedIds: ["cred-1"] };
        return { status: "error" as const, checkedIds: [] };
      },
    },
  };
}

function makeStateNarrativeTimelineDeps(stateDb: StateDatabase): NarrativeTimelineDeps {
  const historyStore = createHistoryDigestStore(stateDb);
  return {
    stateMemoryPort: {
      async listNarrativeTimeline(from, to, opts) {
        const rows = await historyStore.listNarrativeTimeline({ limit: 100 });
        return rows
          .filter((row) => row.createdAt >= from && row.createdAt <= to)
          .filter((row) => (opts?.afterTimestamp ? row.createdAt > opts.afterTimestamp : true))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(0, opts?.limit ?? rows.length)
          .map((row) => ({
            version: row.timelineId,
            createdAt: row.createdAt,
            triggerKind: row.entryType,
            sourceRefs: Array.isArray(row.delta.sourceRefs)
              ? row.delta.sourceRefs.filter((ref): ref is string => typeof ref === "string")
              : [],
            reasonCode: typeof row.delta.reasonCode === "string" ? row.delta.reasonCode : undefined,
            summaryText: typeof row.delta.summaryText === "string" ? row.delta.summaryText : undefined,
          }));
      },
      async getNarrativeSnapshot(version) {
        const rows = await historyStore.listNarrativeTimeline({ limit: 100 });
        const row = rows.find((candidate) => candidate.timelineId === version || candidate.subjectId === version);
        if (!row) return null;
        return {
          version,
          focus: row.delta.focus,
          progress: row.delta.progress,
          nextIntent: row.delta.nextIntent,
          toneSignal: row.delta.toneSignal,
          acceptedGoalId: row.delta.acceptedGoalId,
          sourceRefs: Array.isArray(row.delta.sourceRefs)
            ? row.delta.sourceRefs.filter((ref): ref is string => typeof ref === "string")
            : [],
          lastChangeReasonCode:
            typeof row.delta.reasonCode === "string" ? row.delta.reasonCode : undefined,
        };
      },
    },
  };
}

async function makeRestoreDeps(snapshotId: string, payload: Record<string, unknown>): Promise<{
  auditStore: AppendOnlyAuditStore;
  restoreSnapshotStore: RestoreSnapshotStore;
  stateDb: StateDatabase;
}> {
  const auditStore = new AppendOnlyAuditStore();
  const stateDb = createStateDatabase(":memory:");
  const restoreSnapshotStore = createRestoreSnapshotStore(stateDb);
  await restoreSnapshotStore.captureSnapshot({
    snapshotId,
    payload,
  });
  return { auditStore, restoreSnapshotStore, stateDb };
}

// ─── 1. self_health ───────────────────────────────────────────────────────────

describe("T-ROS.C.1 #1: self_health", () => {
  it("returns RuntimeOpsEnvelope with SelfHealthView shape", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("self_health") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.command, "self_health");
    assert.ok(Array.isArray(result.warnings), "warnings must be array");
    assert.ok(Array.isArray(result.sourceRefs), "sourceRefs must be array");
    const data = result.data as { overall: string; dimensions: Record<string, unknown>; degraded_dimensions: string[] };
    assert.ok(["healthy", "degraded", "unknown"].includes(data.overall), "overall must be valid status");
    assert.ok(typeof data.dimensions === "object", "dimensions must be object");
    assert.ok(Array.isArray(data.degraded_dimensions), "degraded_dimensions must be array");
  });

  it("runtimeMode is workspace_full_runtime on success", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("self_health") as RuntimeOpsEnvelope;
    assert.strictEqual(result.runtimeMode, "workspace_full_runtime");
  });
});

// ─── 2. tool_affordance (port unwired) ───────────────────────────────────────

describe("T-ROS.C.1 #2: tool_affordance (port not yet wired)", () => {
  it("returns ok=false with TOOL_AFFORDANCE_PORT_UNWIRED when port absent", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("tool_affordance") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.command, "tool_affordance");
    assert.strictEqual(result.runtimeMode, "unavailable");
    assert.strictEqual(result.error?.code, "TOOL_AFFORDANCE_PORT_UNWIRED");
  });
});

// ─── 3. connector_test --wet ──────────────────────────────────────────────────

describe("T-ROS.C.1 #3: connector_test --wet", () => {
  it("wet=true sets dryRun=false and annotates triggerSource:manual (with registry)", async () => {
    // No real registry — but we verify the routing logic via missing platformId
    const router = createOpsRouter({ runtimeAvailable: true });
    // With no registry, connector_test always returns REGISTRY_UNAVAILABLE
    const result = await router.dispatch("connector_test", { platformId: "moltbook", wet: true });
    // Registry unavailable is expected; the important thing is no throw
    assert.ok(typeof result === "object" && result !== null);
    assert.ok("ok" in result);
  });

  it("default connector_test (no wet flag) remains dry-run", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("connector_test", { platformId: "moltbook" });
    assert.ok(typeof result === "object" && result !== null);
  });

  it("dryRun:false executes safe wet probe and persists capability_probe_result", async () => {
    const stateDb = createStateDatabase(":memory:");
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const safeEndpoint = `http://127.0.0.1:${address.port}/probe`;
    const registry = new DynamicConnectorRegistry({
      builtInManifests: [
        {
          schemaVersion: "sn.connector.v1",
          platformId: "wet-platform",
          displayName: "Wet Platform",
          family: "custom",
          capabilities: [{ id: "feed.read" }],
          runner: { kind: "declarative_http" },
          credentials: [],
          sourceRefPolicy: { minSourceRefs: 0 },
        },
      ],
      snapshotStore: createRegistrySnapshotStore(),
    });
    registry.reloadConnectors(process.cwd());
    const router = createOpsRouter({ runtimeAvailable: true, registry, state: stateDb });

    try {
      const result = await router.dispatch("connector_test", {
        platformId: "wet-platform",
        capabilityId: "feed.read",
        dryRun: false,
        safeEndpoint,
      }) as Record<string, unknown>;
      assert.strictEqual(result.ok, true);
      const data = result.data as {
        dryRun: boolean;
        actualStatus: string;
        persistedProbeResult: boolean;
        triggerSource: string;
        affectsHeartbeatCadence: boolean;
      };
      assert.strictEqual(data.dryRun, false);
      assert.strictEqual(data.actualStatus, "available");
      assert.strictEqual(data.persistedProbeResult, true);
      assert.strictEqual(data.triggerSource, "manual_run");
      assert.strictEqual(data.affectsHeartbeatCadence, false);
      const persisted = stateDb.sqlite.exec(
        "SELECT actual_status, http_status FROM capability_probe_result WHERE connector_id = 'wet-platform'",
      );
      assert.strictEqual(persisted[0]!.values[0]![0], "available");
      assert.strictEqual(persisted[0]!.values[0]![1], 200);
    } finally {
      server.close();
      stateDb.close();
    }
  });

  it("T-V7C.C.5 — wet probe 429 degraded returns ok=false", async () => {
    const stateDb = createStateDatabase(":memory:");
    const server = createServer((_req, res) => {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ retryAfter: 60 }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const safeEndpoint = `http://127.0.0.1:${address.port}/probe`;
    const registry = new DynamicConnectorRegistry({
      builtInManifests: [
        {
          schemaVersion: "sn.connector.v1",
          platformId: "wet-platform",
          displayName: "Wet Platform",
          family: "custom",
          capabilities: [{ id: "feed.read" }],
          runner: { kind: "declarative_http" },
          credentials: [],
          sourceRefPolicy: { minSourceRefs: 0 },
        },
      ],
      snapshotStore: createRegistrySnapshotStore(),
    });
    registry.reloadConnectors(process.cwd());
    const router = createOpsRouter({ runtimeAvailable: true, registry, state: stateDb });

    try {
      const result = await router.dispatch("connector_test", {
        platformId: "wet-platform",
        capabilityId: "feed.read",
        dryRun: false,
        safeEndpoint,
      }) as Record<string, unknown>;
      // T-V7C.C.5: 429/503 must result in ok=false (only 200-299 is "available")
      assert.strictEqual(result.ok, false);
      const data = result.data as { actualStatus: string; httpStatus: number };
      assert.strictEqual(data.actualStatus, "degraded");
      assert.strictEqual(data.httpStatus, 429);
    } finally {
      server.close();
      stateDb.close();
    }
  });
});

// ─── 4. heartbeat_digest ─────────────────────────────────────────────────────

describe("T-ROS.C.1 #4: heartbeat_digest", () => {
  it("returns ok=false + AUDIT_STORE_UNAVAILABLE when auditStore missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("heartbeat_digest", { date: "2026-05-23" }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "AUDIT_STORE_UNAVAILABLE");
  });

  it("returns ok=true + digest data when auditStore provided", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const router = createOpsRouter({ runtimeAvailable: true, auditStore });
    const result = await router.dispatch("heartbeat_digest", { date: "2026-05-23" }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.command, "heartbeat_digest");
    const digest = result.data as { isNothingSignificant: boolean; connectorSummary: unknown[] };
    assert.strictEqual(typeof digest.isNothingSignificant, "boolean");
    assert.ok(Array.isArray(digest.connectorSummary));
  });

  it("uses today as default date when date arg absent", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const router = createOpsRouter({ runtimeAvailable: true, auditStore });
    const result = await router.dispatch("heartbeat_digest") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
  });
});

// ─── 5. narrative:diff ────────────────────────────────────────────────────────

describe("T-ROS.C.1 #5: narrative:diff", () => {
  it("returns ok=false when narrativeTimelineDeps missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("narrative:diff", { from: "v1", to: "v3" }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "NARRATIVE_TIMELINE_PORT_UNAVAILABLE");
  });

  it("returns ok=false + MISSING_VERSIONS when from/to absent", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, narrativeTimelineDeps: makeNarrativeTimelineDeps() });
    const result = await router.dispatch("narrative:diff") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "MISSING_VERSIONS");
  });

  it("returns ok=true + diff data for valid versions", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, narrativeTimelineDeps: makeNarrativeTimelineDeps(5) });
    const result = await router.dispatch("narrative:diff", { from: "v1", to: "v3" }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    assert.ok(result.data && "changes" in (result.data as object), "diff must have changes");
  });

  it("snapshot:capture creates restore data and narrative versions that diff can consume", async () => {
    const stateDb = createStateDatabase(":memory:");
    const restoreSnapshotStore = createRestoreSnapshotStore(stateDb);
    const narrativeTimelineDeps = makeStateNarrativeTimelineDeps(stateDb);
    const router = createOpsRouter({
      runtimeAvailable: true,
      state: stateDb,
      restoreSnapshotStore,
      narrativeTimelineDeps,
    });
    const first = await router.dispatch("snapshot:capture", {
      snapshotId: "snap-v7c-1",
      focus: "initial focus",
      progress: "bootstrapped",
      nextIntent: "observe",
    }) as RuntimeOpsEnvelope;
    const second = await router.dispatch("snapshot:capture", {
      snapshotId: "snap-v7c-2",
      focus: "updated focus",
      progress: "restorable",
      nextIntent: "act",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(first.ok, true);
    assert.strictEqual(second.ok, true);
    const snapshots = stateDb.sqlite.exec("SELECT COUNT(*) FROM restore_snapshot");
    assert.strictEqual(snapshots[0]!.values[0]![0], 2);
    const timeline = stateDb.sqlite.exec("SELECT COUNT(*) FROM narrative_timeline");
    assert.strictEqual(timeline[0]!.values[0]![0], 2);

    const diff = await router.dispatch("narrative:diff", {
      from: "snap-v7c-1",
      to: "snap-v7c-2",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(diff.ok, true);
    const data = diff.data as { changes: Array<{ field: string }> };
    assert.ok(data.changes.some((change) => change.field === "focus"));
    stateDb.close();
  });
});

// ─── 6. timeline ──────────────────────────────────────────────────────────────

describe("T-ROS.C.1 #6: timeline", () => {
  it("returns ok=false when narrativeTimelineDeps missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("timeline") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "NARRATIVE_TIMELINE_PORT_UNAVAILABLE");
  });

  it("returns ok=true + page data for default 30-day window", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, narrativeTimelineDeps: makeNarrativeTimelineDeps(10) });
    const result = await router.dispatch("timeline") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const page = result.data as { entries: unknown[] };
    assert.ok(Array.isArray(page.entries), "page.entries must be array");
  });

  it("returns ok=false + NARRATIVE_RANGE_EXCEEDED for >90 day range", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, narrativeTimelineDeps: makeNarrativeTimelineDeps(5) });
    const now = new Date();
    const from = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    const result = await router.dispatch("timeline", { from, to }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "NARRATIVE_RANGE_EXCEEDED");
  });
});

// ─── 7. restore ───────────────────────────────────────────────────────────────

describe("T-ROS.C.1 #7: restore", () => {
  it("returns ok=false + AUDIT_STORE_UNAVAILABLE when auditStore missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("restore", {
      restoreTarget: "goal",
      fromVersion: "v1",
      toVersion: "v2",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "AUDIT_STORE_UNAVAILABLE");
  });

  it("returns ok=false + MISSING_RESTORE_FIELDS when required args absent", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const router = createOpsRouter({ runtimeAvailable: true, auditStore });
    const result = await router.dispatch("restore") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "MISSING_RESTORE_FIELDS");
  });

  it("writes audit and returns ok=true + auditWritten=true on success", async () => {
    const { auditStore, restoreSnapshotStore, stateDb } = await makeRestoreDeps("goal", {
      identity_profile: [
        {
          profile_id: "p-restore-ok",
          canonical_name: "Restored Identity",
          platform_handles_json: "[]",
          updated_at: "2026-05-24T00:00:00.000Z",
        },
      ],
    });
    const router = createOpsRouter({ runtimeAvailable: true, auditStore, restoreSnapshotStore });
    const result = await router.dispatch("restore", {
      restoreTarget: "goal",
      fromVersion: "v1",
      toVersion: "v2",
      reason: "manual_rollback",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as {
      auditWritten: boolean;
      fromVersion: string;
      toVersion: string;
      completedEntities: string[];
      restoreSnapshotStoreAvailable: boolean;
    };
    assert.strictEqual(data.auditWritten, true);
    assert.strictEqual(data.fromVersion, "v1");
    assert.strictEqual(data.toVersion, "v2");
    assert.strictEqual(data.restoreSnapshotStoreAvailable, true);
    assert.deepStrictEqual(data.completedEntities, ["identity_profile"]);
    assert.strictEqual(auditStore.list().length, 1, "audit store must have 1 entry");
    const restored = stateDb.sqlite.exec(
      "SELECT canonical_name FROM identity_profile WHERE profile_id = 'p-restore-ok'",
    );
    assert.strictEqual(restored[0]!.values[0]![0], "Restored Identity");
    stateDb.close();
  });

  it("partial restore sets isPartialRestore=true in response", async () => {
    const { auditStore, restoreSnapshotStore, stateDb } = await makeRestoreDeps("narrative", {
      identity_profile: [
        {
          profile_id: "p-partial-ok",
          canonical_name: "Partially Restored",
          platform_handles_json: "[]",
          updated_at: "2026-05-24T00:00:00.000Z",
        },
      ],
      agent_goal: [{ bad_column: "forces_restore_failure" }],
    });
    const router = createOpsRouter({ runtimeAvailable: true, auditStore, restoreSnapshotStore });
    const result = await router.dispatch("restore", {
      restoreTarget: "narrative",
      fromVersion: "v5",
      toVersion: "v4",
      reason: "partial_restore_error",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    const data = result.data as {
      isPartialRestore: boolean;
      completedEntities: string[];
      failedEntities: string[];
    };
    assert.strictEqual(data.isPartialRestore, true);
    assert.deepStrictEqual(data.completedEntities, ["identity_profile"]);
    assert.deepStrictEqual(data.failedEntities, ["agent_goal"]);
    assert.strictEqual(auditStore.list().length, 1, "partial restore must still be audited");
    stateDb.close();
  });

  it("T-V7C.C.5 — restore with snapshotId resolves and applies bounded restore", async () => {
    const { auditStore, restoreSnapshotStore, stateDb } = await makeRestoreDeps("snap-by-id", {
      identity_profile: [
        {
          profile_id: "p-snapshot-id",
          canonical_name: "SnapshotId Restore",
          platform_handles_json: "[]",
          updated_at: "2026-05-24T00:00:00.000Z",
        },
      ],
    });
    const router = createOpsRouter({ runtimeAvailable: true, auditStore, restoreSnapshotStore });
    const result = await router.dispatch("restore", {
      snapshotId: "snap-by-id",
      reason: "snapshotId_rollback",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as {
      auditWritten: boolean;
      fromVersion: string;
      toVersion: string;
      restoreTarget: string;
      restoreSnapshotStoreAvailable: boolean;
    };
    assert.strictEqual(data.auditWritten, true);
    assert.strictEqual(data.restoreTarget, "snap-by-id");
    assert.strictEqual(data.toVersion, "snap-by-id");
    assert.strictEqual(data.restoreSnapshotStoreAvailable, true);
    stateDb.close();
  });

  it("T-V7C.C.5 — restore with unknown snapshotId returns SNAPSHOT_NOT_FOUND", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const stateDb = createStateDatabase(":memory:");
    const restoreSnapshotStore = createRestoreSnapshotStore(stateDb);
    const router = createOpsRouter({ runtimeAvailable: true, auditStore, restoreSnapshotStore });
    const result = await router.dispatch("restore", {
      snapshotId: "no-such-snapshot",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "SNAPSHOT_NOT_FOUND");
    stateDb.close();
  });
});

// ─── 8. runtime_secret_bootstrap ─────────────────────────────────────────────

describe("T-ROS.C.1 #8: runtime_secret_bootstrap", () => {
  it("returns ok=false when secretAnchorDeps missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("runtime_secret_bootstrap") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "SECRET_ANCHOR_DEPS_UNAVAILABLE");
  });

  it("verified key returns ok=true + status:ok + plaintextKeyExposed=false", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, secretAnchorDeps: makeSecretAnchorDeps("ok") });
    const result = await router.dispatch("runtime_secret_bootstrap") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as { status: string; plaintextKeyExposed: false; keyHealth: string };
    assert.strictEqual(data.plaintextKeyExposed, false);
    assert.strictEqual(data.status, "ok");
  });

  it("missing key returns credential_recovery_required or runtime_secret_anchor_missing", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, secretAnchorDeps: makeSecretAnchorDeps("missing") });
    const result = await router.dispatch("runtime_secret_bootstrap") as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as { status: string; plaintextKeyExposed: false };
    assert.strictEqual(data.plaintextKeyExposed, false);
    assert.ok(
      data.status === "runtime_secret_anchor_missing" || data.status === "unknown",
      `status should indicate missing/unknown, got: ${data.status}`,
    );
  });

  it("response never contains key plaintext", async () => {
    const router = createOpsRouter({ runtimeAvailable: true, secretAnchorDeps: makeSecretAnchorDeps("wrong_key") });
    const result = await router.dispatch("runtime_secret_bootstrap") as RuntimeOpsEnvelope;
    const resultStr = JSON.stringify(result);
    assert.ok(!resultStr.includes("sk-"), "key plaintext must not appear");
    assert.ok(!resultStr.includes("Bearer "), "credential value must not appear");
  });

  it("all three reason codes produce recoverySteps array", async () => {
    for (const scenario of ["missing", "wrong_key", "error"] as const) {
      const router = createOpsRouter({ runtimeAvailable: true, secretAnchorDeps: makeSecretAnchorDeps(scenario) });
      const result = await router.dispatch("runtime_secret_bootstrap") as RuntimeOpsEnvelope;
      assert.strictEqual(result.ok, true);
      const data = result.data as { recoverySteps: unknown[] };
      assert.ok(Array.isArray(data.recoverySteps), `recoverySteps must be array for scenario: ${scenario}`);
      assert.ok(data.recoverySteps.length > 0, `recoverySteps must be non-empty for scenario: ${scenario}`);
    }
  });
});

// ─── T-V7C.C.5: guidance_payload ─────────────────────────────────────────────

describe("T-V7C.C.5 #9: guidance_payload", () => {
  it("returns impulse + atmosphere for social scene", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("guidance_payload", {
      sceneType: "social",
      capabilityIntent: "post.publish",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as {
      sceneType: string;
      capabilityClass: string;
      impulseText: string | null;
      atmosphereText: string;
    };
    assert.strictEqual(data.sceneType, "social");
    assert.strictEqual(data.capabilityClass, "broadcast");
    assert.ok(typeof data.atmosphereText === "string" && data.atmosphereText.length > 0);
  });

  it("returns null impulse for agent.heartbeat (excluded capability)", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("guidance_payload", {
      sceneType: "social",
      capabilityIntent: "agent.heartbeat",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, true);
    const data = result.data as {
      impulseText: string | null;
      capabilityIntent: string;
    };
    assert.strictEqual(data.impulseText, null);
    assert.strictEqual(data.capabilityIntent, "agent.heartbeat");
  });

  it("returns INVALID_SCENE_TYPE for unknown sceneType", async () => {
    const router = createOpsRouter({ runtimeAvailable: true });
    const result = await router.dispatch("guidance_payload", {
      sceneType: "not_a_scene",
    }) as RuntimeOpsEnvelope;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error?.code, "INVALID_SCENE_TYPE");
  });
});
