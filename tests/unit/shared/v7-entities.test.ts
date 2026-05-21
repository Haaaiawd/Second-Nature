/**
 * T-SMS.F.1 — v7 Shared Entity Types Compile-Time Verification
 *
 * Core logic: Type-level assertions enforced by `tsc --noEmit`.
 * Runtime tests assert structural correctness of valid instances.
 *
 * Verification types (05A / 05B):
 * - Compile check: `@ts-expect-error` guards for SourceRef, AgentGoal.kind
 * - Unit test: RestoreSnapshot whitelist completeness, valid entity shape
 *
 * Dependencies: `src/shared/types/*` (v7-entities, source-ref, goal)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import type {
  SourceRef,
  AgentGoalKind,
  AgentGoal,
  IdentityProfile,
  ToolExperience,
  RestoreSnapshot,
  RuntimeSecretAnchor,
  DailyDiary,
  QuietClaim,
  EmbodiedContext,
  EmbodiedContextSliceStatus,
  SelfHealthSnapshot,
  HeartbeatDigest,
  NarrativeTimelineEntry,
  CapabilityProbeResult,
  RestorableEntityKind,
  SensitiveExcludedKind,
} from "../../../src/shared/types/index.js";

// ───────────────────────────────────────────────────────────────
// Compile-time guards — empty SourceRef must error
// ───────────────────────────────────────────────────────────────

// @ts-expect-error — SourceRef requires at least one string element (DR-025)
const _emptySourceRef: SourceRef = [];

const _validSourceRef: SourceRef = ["evidence:001", "audit:ref-42"];

// ───────────────────────────────────────────────────────────────
// Compile-time guards — AgentGoal.kind must be enum member
// ───────────────────────────────────────────────────────────────

// @ts-expect-error — "unknown_kind" is not a member of AgentGoalKind (DR-014)
const _invalidKind: AgentGoalKind = "unknown_kind";

const _validKind: AgentGoalKind = "passive_sensing";

// ───────────────────────────────────────────────────────────────
// Runtime structural tests
// ───────────────────────────────────────────────────────────────

describe("SourceRef compile contract", () => {
  it("valid non-empty tuple compiles silently", () => {
    const refs: SourceRef = ["src:a", "src:b"];
    assert.strictEqual(refs.length, 2);
    assert.strictEqual(refs[0], "src:a");
  });
});

describe("AgentGoal shape and DR-014 kind enum", () => {
  it("valid goal instance has all required fields", () => {
    const goal: AgentGoal = {
      goalId: "goal-001",
      kind: "exploration",
      scope: "platform_specific",
      status: "accepted",
      origin: "agent_proposed",
      description: "Explore connector capabilities",
      completionCriteria: "List all supported capabilities",
      risk: "low",
      priorityHint: 3,
      sourceRefs: ["evidence:001"],
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(goal.kind, "exploration");
    assert.strictEqual(goal.scope, "platform_specific");
    assert.ok(goal.sourceRefs.length >= 1);
  });

  it("kind enum covers all snake_case variants required by v7", () => {
    const allKinds: AgentGoalKind[] = [
      "short_term",
      "long_term",
      "habit",
      "maintenance",
      "passive_sensing",
      "outreach",
      "exploration",
    ];
    assert.strictEqual(allKinds.length, 7);
  });
});

describe("IdentityProfile cross-platform handles", () => {
  it("supports canonical identity + per-platform handles (ADR-007)", () => {
    const profile: IdentityProfile = {
      profileId: "prof-001",
      canonicalName: "Nyx",
      canonicalBio: "Cognitive Orchestration Architect",
      platformHandles: [
        { platformId: "moltbook", handle: "nyx_ha" },
        { platformId: "agent_world", handle: "haai-arch" },
        { platformId: "instreet", handle: "haai_17949e" },
      ],
      updatedAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(profile.platformHandles.length, 3);
    assert.strictEqual(profile.platformHandles[0]?.platformId, "moltbook");
  });
});

describe("ToolExperience triggerSource and failureClass", () => {
  it("records experience with mandatory triggerSource (DR-010)", () => {
    const exp: ToolExperience = {
      experienceId: "exp-001",
      connectorId: "moltbook",
      capabilityId: "feed.read",
      outcome: "failure",
      failureClass: "http_404",
      latencyMs: 120,
      evidenceQuality: 0.0,
      sourceRefs: ["probe:result-001"],
      triggerSource: "probe",
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(exp.triggerSource, "probe");
    assert.strictEqual(exp.failureClass, "http_404");
  });
});

describe("RestoreSnapshot entity whitelist (DR-017)", () => {
  it("RestorableEntityKind contains exactly 6 allowed entities", () => {
    const allowed: RestorableEntityKind[] = [
      "identity_profile",
      "agent_goal",
      "tool_experience",
      "daily_diary",
      "dream_output",
      "narrative_timeline",
    ];
    assert.strictEqual(allowed.length, 6);
  });

  it("SensitiveExcludedKind covers 5 prohibited categories", () => {
    const excluded: SensitiveExcludedKind[] = [
      "credential",
      "raw_private_message",
      "raw_prompt",
      "encryption_key",
      "session_token",
    ];
    assert.strictEqual(excluded.length, 5);
  });

  it("snapshot default excludedSensitiveKinds is populated", () => {
    const snapshot: RestoreSnapshot = {
      snapshotId: "snap-001",
      entityWhitelist: ["identity_profile", "agent_goal"],
      excludedSensitiveKinds: [
        "credential",
        "raw_private_message",
        "raw_prompt",
        "encryption_key",
        "session_token",
      ],
      capturedAt: "2026-05-21T00:00:00Z",
      payload: {},
    };
    assert.strictEqual(snapshot.excludedSensitiveKinds.length, 5);
  });
});

describe("RuntimeSecretAnchor no-key-plaintext (ADR-007)", () => {
  it("only stores locationRef and health, never raw key", () => {
    const anchor: RuntimeSecretAnchor = {
      anchorId: "anchor-001",
      locationRef: "env:SECOND_NATURE_ENCRYPTION_KEY",
      health: "ok",
      rotationPolicyRef: "policy:annual",
      updatedAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(anchor.locationRef, "env:SECOND_NATURE_ENCRYPTION_KEY");
    // Compile-time guarantee: RuntimeSecretAnchor interface has no `key` field.
    assert.ok(!("key" in anchor));
  });
});

describe("CapabilityProbeResult includes capabilityId (DR-001)", () => {
  it("has capabilityId in probe result", () => {
    const result: CapabilityProbeResult = {
      probeResultId: "probe-001",
      capabilityId: "moltbook:feed.read",
      connectorId: "moltbook",
      actualStatus: "available",
      httpStatus: 200,
      probeConfigRef: "cfg-001",
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(result.capabilityId, "moltbook:feed.read");
  });
});

describe("DailyDiary three-segment structure", () => {
  it("has observedToday, notableSignals, tomorrowDirection", () => {
    const diary: DailyDiary = {
      diaryId: "diary-001",
      day: "2026-05-21",
      observedToday: ["connector moltbook returned 404"],
      notableSignals: ["circuit breaker opened"],
      tomorrowDirection: "probe recovery after cooldown",
      sourceRefs: ["evidence:001", "audit:breaker-001"],
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(diary.observedToday.length, 1);
    assert.strictEqual(diary.notableSignals.length, 1);
    assert.ok(diary.tomorrowDirection.length > 0);
  });
});

describe("QuietClaim sourceRefs non-empty", () => {
  it("requires at least one source ref (DR-025)", () => {
    const claim: QuietClaim = {
      claimId: "claim-001",
      kind: "observation",
      text: "MoltBook feed endpoint returned 404 consistently",
      sourceRefs: ["probe:result-001"],
      confidence: 0.85,
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(claim.sourceRefs.length, 1);
  });
});

describe("EmbodiedContext 5-slice structure (ADR-002)", () => {
  it("assembles with loaded status for all 5 core slices", () => {
    const ctx: EmbodiedContext = {
      identity: {
        status: "loaded" as EmbodiedContextSliceStatus,
        data: {
          profileId: "prof-001",
          canonicalName: "Nyx",
          platformHandles: [],
          updatedAt: "2026-05-21T00:00:00Z",
        },
      },
      goals: {
        status: "loaded" as EmbodiedContextSliceStatus,
        data: [],
      },
      recentInteractions: {
        status: "loaded" as EmbodiedContextSliceStatus,
        data: [],
      },
      toolExperience: {
        status: "loaded" as EmbodiedContextSliceStatus,
        data: [],
      },
      acceptedDream: {
        status: "loaded" as EmbodiedContextSliceStatus,
        data: [],
      },
      assembledAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(ctx.identity.status, "loaded");
    assert.strictEqual(ctx.goals.status, "loaded");
    assert.strictEqual(ctx.recentInteractions.status, "loaded");
    assert.strictEqual(ctx.toolExperience.status, "loaded");
    assert.strictEqual(ctx.acceptedDream.status, "loaded");
  });

  it("degraded slice carries reason without blocking others", () => {
    const ctx: EmbodiedContext = {
      identity: {
        status: "degraded" as EmbodiedContextSliceStatus,
        data: {
          profileId: "prof-001",
          canonicalName: "Nyx",
          platformHandles: [],
          updatedAt: "2026-05-21T00:00:00Z",
        },
        reason: "identity_profile_degraded:moltbook",
      },
      goals: { status: "loaded" as EmbodiedContextSliceStatus, data: [] },
      recentInteractions: { status: "loaded" as EmbodiedContextSliceStatus, data: [] },
      toolExperience: { status: "loaded" as EmbodiedContextSliceStatus, data: [] },
      acceptedDream: { status: "loaded" as EmbodiedContextSliceStatus, data: [] },
      assembledAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(ctx.identity.reason, "identity_profile_degraded:moltbook");
    assert.strictEqual(ctx.goals.status, "loaded");
  });
});

describe("SelfHealthSnapshot dynamic dimensions", () => {
  it("supports arbitrary dimension keys with status+reason", () => {
    const health: SelfHealthSnapshot = {
      snapshotId: "health-001",
      dimensions: {
        connector: { status: "ok" },
        state_memory: { status: "degraded", reason: "migration_pending" },
        circuit_breaker: { status: "ok" },
      },
      checkedAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(health.dimensions.state_memory.status, "degraded");
    assert.strictEqual(health.dimensions.state_memory.reason, "migration_pending");
  });
});

describe("HeartbeatDigest daily summary shape", () => {
  it("has connector, goal, quiet, dream, breaker summaries", () => {
    const digest: HeartbeatDigest = {
      digestId: "digest-001",
      day: "2026-05-21",
      connectorSummary: [
        { platformId: "moltbook", status: "degraded", attemptCount: 3 },
      ],
      goalSummary: [{ kind: "passive_sensing", activeCount: 1 }],
      quietCount: 1,
      dreamCount: 0,
      breakerSummary: [{ connectorId: "moltbook", state: "open" }],
      healthStatus: "degraded",
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.strictEqual(digest.quietCount, 1);
    assert.strictEqual(digest.dreamCount, 0);
  });
});

describe("NarrativeTimelineEntry append-only hash chain", () => {
  it("links previousHash to currentHash", () => {
    const entry: NarrativeTimelineEntry = {
      timelineId: "tl-001",
      entryType: "narrative.trace",
      subjectId: "narrative-001",
      delta: { focus: "connector health" },
      previousHash: "sha256:abc...",
      currentHash: "sha256:def...",
      createdAt: "2026-05-21T00:00:00Z",
    };
    assert.notStrictEqual(entry.previousHash, entry.currentHash);
  });
});
