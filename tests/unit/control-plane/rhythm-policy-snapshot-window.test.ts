import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { PolicyRepository } from "../../../src/storage/repositories/policy-repository.js";
import { loadRhythmPolicySnapshot } from "../../../src/storage/rhythm/rhythm-policy-snapshot.js";
import {
  assertRhythmPolicySnapshotContract,
  rhythmPolicySnapshotToRhythmPolicy,
} from "../../../src/core/second-nature/rhythm/policy-bridge.js";
import { selectRhythmWindow } from "../../../src/core/second-nature/rhythm/select-window.js";
import type { ContinuitySnapshot } from "../../../src/core/second-nature/types.js";

const baseSnapshot: ContinuitySnapshot = {
  mode: "active",
  currentWindowId: "w-active",
  pendingObligations: [],
  recentOutreachHashes: [],
  deniedIntents: [],
  budgets: { socialUsed: 0, socialLimit: 10 },
};

test("T2.1.2 RhythmPolicySnapshot from state has no allowedIntentKinds", async () => {
  const state = createStateDatabase(":memory:");
  const snap = await loadRhythmPolicySnapshot(state);
  assert.equal("allowedIntentKinds" in snap, false);
  state.close();
});

test("T2.1.2 field drift on snapshot object is rejected before window selection", () => {
  assert.throws(
    () =>
      assertRhythmPolicySnapshotContract({
        quietEnabled: true,
        allowedIntentKinds: [],
      } as Record<string, unknown>),
    /rhythm_policy_snapshot_field_drift:allowedIntentKinds/,
  );
});

test("T2.1.2 snapshot → bridge policy → selectRhythmWindow yields control-plane decision only", async () => {
  const state = createStateDatabase(":memory:");
  const policies = new PolicyRepository(state);
  await policies.upsert({
    platformId: "workspace",
    socialDailyLimit: 3,
    quietEnabled: true,
    outreachDailyBudget: 2,
    updatedAt: new Date().toISOString(),
  });
  const snap = await loadRhythmPolicySnapshot(state);
  const rhythmPolicy = rhythmPolicySnapshotToRhythmPolicy(snap);

  const quietTime = selectRhythmWindow("2026-03-25T23:00:00.000Z", baseSnapshot, rhythmPolicy);
  assert.equal(quietTime.windowId, "w-quiet");
  assert.equal(quietTime.topLevelMode, "quiet");

  const workTime = selectRhythmWindow("2026-03-25T04:00:00.000Z", baseSnapshot, rhythmPolicy);
  assert.equal(workTime.windowId, "w-work");
  assert.equal(workTime.topLevelMode, "active");

  assert.equal("allowedIntentKinds" in quietTime, false);
  state.close();
});

test("T2.1.2 quietDisabled snapshot maps to single open window (maintenance bias via riskSuppressed)", async () => {
  const state = createStateDatabase(":memory:");
  const policies = new PolicyRepository(state);
  await policies.upsert({
    platformId: "workspace",
    socialDailyLimit: 3,
    quietEnabled: false,
    outreachDailyBudget: 2,
    updatedAt: new Date().toISOString(),
  });
  const snap = await loadRhythmPolicySnapshot(state);
  const rhythmPolicy = rhythmPolicySnapshotToRhythmPolicy(snap);
  const decision = selectRhythmWindow(
    "2026-03-25T12:00:00.000Z",
    { ...baseSnapshot, riskSuppressed: true },
    rhythmPolicy,
  );
  assert.equal(decision.topLevelMode, "maintenance_only");
  state.close();
});
