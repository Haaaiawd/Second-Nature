import { describe, it } from "node:test";
import assert from "node:assert";
import { createIdleCuriosityPolicy } from "../../../src/core/second-nature/heartbeat/idle-curiosity-policy.js";
import type { AffordanceMap } from "../../../src/shared/types/v7-entities.js";

describe("createIdleCuriosityPolicy", () => {
  const baseMap: AffordanceMap = {
    moltbook: [
      { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "safe" as const },
    ],
    evomap: [
      { platformId: "evomap", capabilityId: "work.discover", intent: "work.discover", status: "exploratory" as const },
    ],
  };

  it("selects a read-only healthy capability", () => {
    const policy = createIdleCuriosityPolicy();
    const result = policy.select(baseMap, []);
    assert.ok(result.candidate);
    assert.strictEqual(result.candidate!.platformId, "evomap");
    assert.strictEqual(result.reason, "idle_sensing_selected");
  });

  it("returns no_eligible_connector when no read-only capabilities exist", () => {
    const policy = createIdleCuriosityPolicy();
    const map: AffordanceMap = {
      moltbook: [
        { platformId: "moltbook", capabilityId: "post.write", intent: "post.write", status: "safe" as const },
      ],
    };
    const result = policy.select(map, []);
    assert.strictEqual(result.candidate, undefined);
    assert.strictEqual(result.reason, "idle_policy_no_eligible_connector");
  });

  it("returns no_eligible_connector when all capabilities are painful", () => {
    const policy = createIdleCuriosityPolicy();
    const map: AffordanceMap = {
      moltbook: [
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "painful" as const },
      ],
    };
    const result = policy.select(map, []);
    assert.strictEqual(result.candidate, undefined);
    assert.strictEqual(result.reason, "idle_policy_no_eligible_connector");
  });

  it("returns no_eligible_connector when all capabilities are unavailable", () => {
    const policy = createIdleCuriosityPolicy();
    const map: AffordanceMap = {
      moltbook: [
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read", status: "unavailable" as const },
      ],
    };
    const result = policy.select(map, []);
    assert.strictEqual(result.candidate, undefined);
    assert.strictEqual(result.reason, "idle_policy_no_eligible_connector");
  });

  it("respects 1-hour cooldown per platform", () => {
    const policy = createIdleCuriosityPolicy();
    const history = [{ platformId: "evomap", at: new Date().toISOString() }];
    const result = policy.select(baseMap, history);
    // evomap is on cooldown, moltbook should be selected
    assert.ok(result.candidate);
    assert.strictEqual(result.candidate!.platformId, "moltbook");
  });

  it("ignores expired cooldown entries", () => {
    const policy = createIdleCuriosityPolicy();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const history = [{ platformId: "evomap", at: twoHoursAgo }];
    const result = policy.select(baseMap, history);
    assert.ok(result.candidate);
    assert.strictEqual(result.candidate!.platformId, "evomap");
  });
});
