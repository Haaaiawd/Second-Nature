/**
 * AffordanceContextScope tests — T-BTS.C.2
 *
 * Coverage:
 * - default allowedStatuses filters to safe + exploratory + needs_auth
 * - blocked (unavailable) always excluded even if in allowedStatuses
 * - platformIds whitelist
 * - goalKind passive_sensing only exposes read-only intents
 * - goalKind task_completion does not filter out read intents
 * - empty platformIds = all platforms
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  applyAffordanceContextScope,
  DEFAULT_ALLOWED_STATUSES,
} from "../../../src/core/second-nature/body/tool-affordance/affordance-context-scope.js";
import type { AffordanceItem } from "../../../src/shared/types/v7-entities.js";

const baseItems: AffordanceItem[] = [
  { platformId: "twitter", capabilityId: "cap-1", intent: "feed.read", status: "safe" },
  { platformId: "twitter", capabilityId: "cap-2", intent: "post.publish", status: "safe" },
  { platformId: "twitter", capabilityId: "cap-3", intent: "message.send", status: "exploratory" },
  { platformId: "twitter", capabilityId: "cap-4", intent: "comment.reply", status: "painful" },
  { platformId: "twitter", capabilityId: "cap-5", intent: "notification.list", status: "unavailable" },
  { platformId: "github", capabilityId: "cap-6", intent: "work.discover", status: "safe" },
  { platformId: "github", capabilityId: "cap-7", intent: "task.claim", status: "needs_auth" },
];

describe("applyAffordanceContextScope", () => {
  it("default allowedStatuses keeps safe + exploratory + needs_auth", () => {
    const result = applyAffordanceContextScope(baseItems);
    assert.deepStrictEqual(
      result.map((i) => i.capabilityId),
      ["cap-1", "cap-2", "cap-3", "cap-6", "cap-7"],
    );
  });

  it("blocked (unavailable) always excluded even when allowedStatuses includes it", () => {
    const result = applyAffordanceContextScope(baseItems, {
      allowedStatuses: ["safe", "exploratory", "unavailable"],
    });
    assert.strictEqual(
      result.some((i) => i.capabilityId === "cap-5"),
      false,
    );
  });

  it("platformIds whitelist filters to specified platforms", () => {
    const result = applyAffordanceContextScope(baseItems, {
      platformIds: ["github"],
    });
    assert.strictEqual(result.length, 2);
    assert(result.every((item) => item.platformId === "github"));
    assert.deepStrictEqual(
      result.map((item) => item.capabilityId),
      ["cap-6", "cap-7"],
    );
  });

  it("empty platformIds allows all platforms", () => {
    const result = applyAffordanceContextScope(baseItems, {
      platformIds: [],
    });
    // Default filter still applies (safe + exploratory + needs_auth)
    assert.strictEqual(result.length, 5);
  });

  it("goalKind passive_sensing only exposes read-only intents", () => {
    const result = applyAffordanceContextScope(baseItems, {
      goalKind: "passive_sensing",
      allowedStatuses: ["safe", "exploratory", "needs_auth", "painful"],
    });
    for (const item of result) {
      assert(
        ["feed.read", "notification.list", "work.discover"].includes(item.intent),
        `unexpected intent ${item.intent} in passive_sensing scope`,
      );
    }
  });

  it("goalKind task_completion keeps all intents (no extra filter)", () => {
    const result = applyAffordanceContextScope(baseItems, {
      goalKind: "task_completion",
      allowedStatuses: ["safe", "exploratory", "needs_auth"],
    });
    assert(result.some((i) => i.intent === "post.publish"));
    assert(result.some((i) => i.intent === "feed.read"));
  });

  it("custom allowedStatuses includes painful when specified", () => {
    const result = applyAffordanceContextScope(baseItems, {
      allowedStatuses: ["safe", "exploratory", "painful"],
    });
    assert(result.some((i) => i.capabilityId === "cap-4"));
  });
});
