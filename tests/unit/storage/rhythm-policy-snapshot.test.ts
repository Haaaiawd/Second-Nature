import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { PolicyRepository } from "../../../src/storage/repositories/policy-repository.js";
import { loadRhythmPolicySnapshot } from "../../../src/storage/rhythm/rhythm-policy-snapshot.js";

test("loadRhythmPolicySnapshot returns defaults when no policy row exists", async () => {
  const state = createStateDatabase(":memory:");
  const snap = await loadRhythmPolicySnapshot(state);
  assert.equal(typeof snap.quietEnabled, "boolean");
  assert.equal(typeof snap.socialDailyLimit, "number");
  assert.equal(typeof snap.outreachDailyBudget, "number");
  assert.equal("allowedIntentKinds" in snap, false);
  state.close();
});

test("loadRhythmPolicySnapshot reads workspace policy without decision fields", async () => {
  const state = createStateDatabase(":memory:");
  const policies = new PolicyRepository(state);
  await policies.upsert({
    platformId: "workspace",
    socialDailyLimit: 3,
    quietEnabled: false,
    outreachDailyBudget: 4,
    updatedAt: new Date().toISOString(),
  });

  const snap = await loadRhythmPolicySnapshot(state);
  assert.equal(snap.socialDailyLimit, 3);
  assert.equal(snap.quietEnabled, false);
  assert.equal(snap.outreachDailyBudget, 4);
  assert.equal("allowedIntentKinds" in snap, false);
  state.close();
});
