/**
 * T-V7C.C.3 集成测试 — Rhythm Loop Closure
 *
 * 验收标准:
 *  - Quiet 后 Dream 自动触发或写 explicit skip reason
 *  - accepted Dream projection 可通过 DiaryDreamStore 读取（state already wired via assembler）
 *  - digest delivery target 可用时写 deliveredAt + proof
 *  - digest delivery target 不可用时写 fallbackReason
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  runSourceBackedQuiet,
  type QuietDreamSchedulePort,
} from "../../../src/core/second-nature/quiet/run-source-backed-quiet.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import type { HeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import {
  generateHeartbeatDigest,
  type HeartbeatDigestAssemblerDeps,
  type DigestDeliveryAdapter,
  type HeartbeatDigest,
} from "../../../src/observability/services/heartbeat-digest-assembler.js";
import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_DAY = "2026-05-25";
const TEST_TIMESTAMP = `${TEST_DAY}T10:00:00.000Z`;

/**
 * Minimal HeartbeatRuntimeSnapshot for Quiet tests.
 * Evidence refs are pre-filled so Quiet can produce a real artifact.
 */
function makeRuntimeWithEvidence(): HeartbeatRuntimeSnapshot {
  return {
    continuity: {
      mode: "active",
      currentWindowId: "w1",
      pendingObligations: [],
      recentOutreachHashes: [],
      deniedIntents: [],
      budgets: { socialUsed: 0, socialLimit: 5 },
      awaitingUserInput: false,
      riskSuppressed: false,
    },
    lifeEvidence: {
      evidenceRefs: [
        {
          id: "ev:moltbook:feed:1",
          kind: "connector_result",
          uri: "platform://moltbook/feed.read",
          observedAt: TEST_TIMESTAMP,
        },
      ],
      platformEventCount: 1,
      workEventCount: 0,
    },
    rhythmWindow: {
      windowId: "w1",
      allowedIntentKinds: [
        "work",
        "exploration",
        "social",
        "quiet",
        "reflection",
        "outreach",
        "maintenance",
      ],
      quietBias: true,
    },
    hardGuards: {
      hasDuplicateIntent: () => false,
      isOutreachCooldownClear: () => true,
    },
  };
}

function makeQuietIntent(): CandidateIntent {
  return {
    id: "intent-quiet",
    kind: "quiet",
    summary: "quiet window bookkeeping",
    effectClass: "no_effect",
    sourceRefs: [],
    idempotencyKey: "quiet:bookkeeping",
    goalInfluenceRefs: [],
    priority: 55,
    source: "quiet_plan",
  } as CandidateIntent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("T-V7C.C.3 — Rhythm Loop Closure", () => {
  it("Quiet auto-triggers Dream (quiet_completion) after successful artifact write", async () => {
    const scheduled: Array<{ triggerKind: string; runId: string }> = [];
    const mockDreamPort: QuietDreamSchedulePort = {
      async scheduleDream(params) {
        scheduled.push({ triggerKind: params.triggerKind, runId: params.runId });
        return { status: "started" };
      },
    };

    const result = await runSourceBackedQuiet({
      candidate: makeQuietIntent(),
      runtime: makeRuntimeWithEvidence(),
      day: TEST_DAY,
      dreamSchedulePort: mockDreamPort,
    });

    assert.strictEqual(
      result.result.status,
      "intent_selected",
      `expected intent_selected, got ${result.result.status}`,
    );
    assert.ok(
      result.result.reasons.includes("quiet_artifact_written"),
      `expected quiet_artifact_written in reasons: ${result.result.reasons.join(", ")}`,
    );
    assert.strictEqual(scheduled.length, 1, "expected Dream to be scheduled once");
    assert.strictEqual(scheduled[0]!.triggerKind, "quiet_completion");
    assert.ok(
      result.result.reasons.some((r) => r === "quiet_dream_scheduled"),
      `expected quiet_dream_scheduled in reasons: ${result.result.reasons.join(", ")}`,
    );
  });

  it("Quiet writes explicit skip reason when Dream scheduler returns skipped (lock held)", async () => {
    const mockDreamPort: QuietDreamSchedulePort = {
      async scheduleDream() {
        return { status: "skipped", reason: "lock_held" };
      },
    };

    const result = await runSourceBackedQuiet({
      candidate: makeQuietIntent(),
      runtime: makeRuntimeWithEvidence(),
      day: TEST_DAY,
      dreamSchedulePort: mockDreamPort,
    });

    assert.strictEqual(result.result.status, "intent_selected");
    assert.ok(
      result.result.reasons.some((r) => r.startsWith("quiet_dream_skip:")),
      `expected quiet_dream_skip:* in reasons: ${result.result.reasons.join(", ")}`,
    );
    assert.ok(
      result.result.reasons.some((r) => r.includes("lock_held")),
      `expected lock_held in skip reason: ${result.result.reasons.join(", ")}`,
    );
  });

  it("Quiet artifact is written without Dream when no dreamSchedulePort provided", async () => {
    const result = await runSourceBackedQuiet({
      candidate: makeQuietIntent(),
      runtime: makeRuntimeWithEvidence(),
      day: TEST_DAY,
      // No dreamSchedulePort
    });

    assert.strictEqual(result.result.status, "intent_selected");
    assert.ok(
      result.result.reasons.includes("quiet_artifact_written"),
      `expected quiet_artifact_written: ${result.result.reasons.join(", ")}`,
    );
    // No dream-related reason emitted
    assert.ok(
      !result.result.reasons.some((r) => r.startsWith("quiet_dream")),
      `unexpected dream reason: ${result.result.reasons.join(", ")}`,
    );
  });

  it("digest generates with delivery proof when adapter returns sent", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const mockAdapter: DigestDeliveryAdapter = {
      async deliver(_digest: HeartbeatDigest) {
        return {
          status: "sent",
          proof: { channelId: "test-channel", messageHash: "abc123" },
          deliveredAt: TEST_TIMESTAMP,
        };
      },
    };

    const deps: HeartbeatDigestAssemblerDeps = {
      auditStore,
      deliveryAdapter: mockAdapter,
      now: () => TEST_TIMESTAMP,
    };

    const digest = await generateHeartbeatDigest(TEST_DAY, deps);

    assert.strictEqual(digest.date, TEST_DAY);
    assert.ok(digest.deliveredAt, "expected deliveredAt to be set on successful delivery");
    assert.ok(digest.deliveryProof, "expected deliveryProof to be set");
    assert.strictEqual(digest.deliveryProof!.channelId, "test-channel");
    assert.strictEqual(digest.deliveryProof!.messageHash, "abc123");
    assert.strictEqual(digest.deliveryFallbackReason, undefined);
  });

  it("digest writes fallbackReason when delivery adapter returns not_sent", async () => {
    const auditStore = new AppendOnlyAuditStore();
    const mockAdapter: DigestDeliveryAdapter = {
      async deliver(_digest: HeartbeatDigest) {
        return {
          status: "not_sent",
          fallbackReason: "channel_unavailable",
        };
      },
    };

    const deps: HeartbeatDigestAssemblerDeps = {
      auditStore,
      deliveryAdapter: mockAdapter,
      now: () => TEST_TIMESTAMP,
    };

    const digest = await generateHeartbeatDigest(TEST_DAY, deps);

    assert.strictEqual(digest.date, TEST_DAY);
    assert.strictEqual(
      digest.deliveryFallbackReason,
      "channel_unavailable",
      `expected channel_unavailable fallback, got: ${digest.deliveryFallbackReason}`,
    );
    assert.strictEqual(digest.deliveredAt, undefined);
    assert.strictEqual(digest.deliveryProof, undefined);
  });

  it("digest generates without delivery adapter (no delivery attempted)", async () => {
    const auditStore = new AppendOnlyAuditStore();

    const deps: HeartbeatDigestAssemblerDeps = {
      auditStore,
      now: () => TEST_TIMESTAMP,
    };

    const digest = await generateHeartbeatDigest(TEST_DAY, deps);

    assert.strictEqual(digest.date, TEST_DAY);
    assert.strictEqual(digest.deliveredAt, undefined);
    assert.strictEqual(digest.deliveryFallbackReason, undefined);
    assert.strictEqual(digest.isNothingSignificant, true);
  });
});
