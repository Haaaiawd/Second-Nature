/**
 * Wave 80 — SourceRefs Goal-Bound Fallback tests
 *
 * When lifeEvidence is empty, exploration/social/outreach/reflection intents
 * should derive sourceRefs from accepted goals so hard guard does not deny.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { planCandidateIntents } from "../../../src/core/second-nature/orchestrator/intent-planner.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";

function makeRuntime(ts: string, opts?: { mode?: "active" | "quiet"; evidenceCount?: number }) {
  const inputs: SnapshotInputs = {
    mode: opts?.mode ?? "active",
    currentWindowId: "win_work_morning",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    lifeEvidenceRefs:
      opts?.evidenceCount && opts.evidenceCount > 0
        ? Array.from({ length: opts.evidenceCount }, (_, i) => ({
            id: `ev-${i}`,
            kind: "connector_result" as const,
            uri: `platform://moltbook/item/ev-${i}`,
          }))
        : [],
    platformEventCount: opts?.evidenceCount ?? 0,
    workEventCount: 0,
    duplicateIntentKeys: [],
    outreachCooldownKeys: [],
  };
  const continuity = buildContinuitySnapshot(inputs);
  return buildHeartbeatRuntimeSnapshot(ts, inputs, continuity);
}

describe("intent-planner sourceRefs fallback (W80)", () => {
  it("fills empty sourceRefs from accepted goals for exploration intent", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 0 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [
        {
          goalId: "goal-explore-1",
          description: "Explore MoltBook integration opportunities",
          status: "accepted",
          origin: "owner_set",
        },
      ],
    });

    const exploration = candidates.find((c) => c.kind === "exploration");
    assert.ok(exploration, "exploration candidate must be planned");
    assert.ok(
      exploration!.sourceRefs.length > 0,
      "exploration must have sourceRefs when accepted goals exist",
    );
    assert.ok(
      exploration!.sourceRefs.some((r) => r.uri.startsWith("goal://")),
      "sourceRefs must contain goal-based refs",
    );
  });

  it("fills empty sourceRefs from accepted goals for social intent", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 0 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [
        {
          goalId: "goal-social-1",
          description: "Engage community on social platforms",
          status: "accepted",
          origin: "owner_set",
        },
      ],
    });

    const social = candidates.find((c) => c.kind === "social");
    assert.ok(social, "social candidate must be planned");
    assert.ok(
      social!.sourceRefs.length > 0,
      "social must have sourceRefs when accepted goals exist",
    );
  });

  it("fills empty sourceRefs from accepted goals for outreach intent", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 0 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [
        {
          goalId: "goal-outreach-1",
          description: "Reach out to users about new features",
          status: "accepted",
          origin: "owner_set",
        },
      ],
    });

    const outreach = candidates.find((c) => c.kind === "outreach");
    assert.ok(outreach, "outreach candidate must be planned");
    assert.ok(
      outreach!.sourceRefs.length > 0,
      "outreach must have sourceRefs when accepted goals exist",
    );
  });

  it("prefers lifeEvidence refs over goal refs when both exist", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 3 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [
        {
          goalId: "goal-explore-1",
          description: "Explore MoltBook integration opportunities",
          status: "accepted",
          origin: "owner_set",
        },
      ],
    });

    const exploration = candidates.find((c) => c.kind === "exploration");
    assert.ok(exploration, "exploration candidate must be planned");
    assert.ok(
      exploration!.sourceRefs.some((r) => r.id.startsWith("ev-")),
      "sourceRefs should prefer evidence refs over goal refs",
    );
  });

  it("does not modify sourceRefs when no accepted goals relate to intent", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 0 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: [],
    });

    const exploration = candidates.find((c) => c.kind === "exploration");
    if (exploration) {
      assert.strictEqual(
        exploration!.sourceRefs.length,
        0,
        "sourceRefs remain empty when no goals and no evidence",
      );
    }
  });

  it("limits goal-based sourceRefs to max 4 per intent", () => {
    const runtime = makeRuntime("2026-05-27T10:00:00Z", { evidenceCount: 0 });
    const candidates = planCandidateIntents(runtime, {
      acceptedGoals: Array.from({ length: 6 }, (_, i) => ({
        goalId: `goal-${i}`,
        description: `Goal ${i}`,
        status: "accepted",
        origin: "owner_set",
      })),
    });

    const exploration = candidates.find((c) => c.kind === "exploration");
    assert.ok(exploration, "exploration candidate must be planned");
    assert.ok(
      exploration!.sourceRefs.length <= 4,
      "goal-based sourceRefs must be capped at 4",
    );
  });
});
