/**
 * capability-class.test.ts — T-V7C.C.4R
 *
 * Unit tests for inferCapabilityClass prefix-based classification.
 * Verifies all known prefixes, agent.* exclusion, and custom capability defaults.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferCapabilityClass,
  CAPABILITY_CLASS_SCENE_MAP,
  type CapabilityClass,
} from "../../../src/guidance/capability-class.js";

describe("inferCapabilityClass", () => {
  // ── consume ──────────────────────────────────────────────────────────────────
  it("feed.read → consume", () => {
    assert.strictEqual(inferCapabilityClass("feed.read"), "consume");
  });
  it("feed.list → consume", () => {
    assert.strictEqual(inferCapabilityClass("feed.list"), "consume");
  });
  it("notification.list → consume", () => {
    assert.strictEqual(inferCapabilityClass("notification.list"), "consume");
  });
  it("notification.read → consume", () => {
    assert.strictEqual(inferCapabilityClass("notification.read"), "consume");
  });

  // ── discover ─────────────────────────────────────────────────────────────────
  it("work.discover → discover", () => {
    assert.strictEqual(inferCapabilityClass("work.discover"), "discover");
  });
  it("work.search → discover", () => {
    assert.strictEqual(inferCapabilityClass("work.search"), "discover");
  });

  // ── broadcast ────────────────────────────────────────────────────────────────
  it("post.publish → broadcast", () => {
    assert.strictEqual(inferCapabilityClass("post.publish"), "broadcast");
  });
  it("post.create → broadcast", () => {
    assert.strictEqual(inferCapabilityClass("post.create"), "broadcast");
  });

  // ── interact ─────────────────────────────────────────────────────────────────
  it("comment.reply → interact", () => {
    assert.strictEqual(inferCapabilityClass("comment.reply"), "interact");
  });
  it("comment.create → interact", () => {
    assert.strictEqual(inferCapabilityClass("comment.create"), "interact");
  });
  it("message.send → interact", () => {
    assert.strictEqual(inferCapabilityClass("message.send"), "interact");
  });
  it("message.reply → interact", () => {
    assert.strictEqual(inferCapabilityClass("message.reply"), "interact");
  });

  // ── claim ────────────────────────────────────────────────────────────────────
  it("task.claim → claim", () => {
    assert.strictEqual(inferCapabilityClass("task.claim"), "claim");
  });
  it("task.assign → claim", () => {
    assert.strictEqual(inferCapabilityClass("task.assign"), "claim");
  });

  // ── agent.* excluded (null) ───────────────────────────────────────────────────
  it("agent.heartbeat → null (excluded from impulse system)", () => {
    assert.strictEqual(inferCapabilityClass("agent.heartbeat"), null);
  });
  it("agent.status → null", () => {
    assert.strictEqual(inferCapabilityClass("agent.status"), null);
  });

  // ── custom / unknown → broadcast (safe default) ───────────────────────────────
  it("custom.action → broadcast (default for unrecognized)", () => {
    assert.strictEqual(inferCapabilityClass("custom.action"), "broadcast");
  });
  it("unknown.xyz → broadcast", () => {
    assert.strictEqual(inferCapabilityClass("unknown.xyz"), "broadcast");
  });

  // ── edge cases ───────────────────────────────────────────────────────────────
  it("empty string → null", () => {
    assert.strictEqual(inferCapabilityClass(""), null);
  });
  it("no dot (bare word) → broadcast default", () => {
    assert.strictEqual(inferCapabilityClass("publish"), "broadcast");
  });
  it("uppercase prefix is normalized → feed.READ → consume", () => {
    assert.strictEqual(inferCapabilityClass("FEED.READ"), "consume");
  });
});

describe("CAPABILITY_CLASS_SCENE_MAP", () => {
  const cases: Array<[CapabilityClass, string]> = [
    ["consume", "explore"],
    ["discover", "explore"],
    ["broadcast", "social"],
    ["interact", "reply"],
    ["claim", "work"],
  ];

  for (const [capClass, expectedScene] of cases) {
    it(`${capClass} → ${expectedScene}`, () => {
      assert.strictEqual(CAPABILITY_CLASS_SCENE_MAP[capClass], expectedScene);
    });
  }
});
