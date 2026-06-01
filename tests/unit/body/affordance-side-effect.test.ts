/**
 * Affordance Side Effect — Unit Tests
 *
 * Validates: capability → side-effect classification, posture assembly,
 * map construction, and policy-facing helpers.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/body-tool-system.md`
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §1.2`
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  deriveConnectorSideEffect,
  assembleCapabilityAffordancePosture,
  buildSideEffectAwareAffordanceMap,
  lookupSideEffectPosture,
  isWriteSideEffect,
  isReadSideEffect,
  isLocalStateSideEffect,
  isUnknownSideEffect,
  effectiveActionSideEffectClass,
  type CapabilityAffordancePosture,
} from "../../../src/core/second-nature/body/tool-affordance/affordance-side-effect.js";

describe("affordance-side-effect", () => {
  describe("deriveConnectorSideEffect", () => {
    it("classifies read capabilities as external_read", () => {
      assert.strictEqual(deriveConnectorSideEffect("feed.read"), "external_read");
      assert.strictEqual(deriveConnectorSideEffect("work.discover"), "external_read");
      assert.strictEqual(deriveConnectorSideEffect("notification.list"), "external_read");
      assert.strictEqual(deriveConnectorSideEffect("profile.inspect"), "external_read");
      assert.strictEqual(deriveConnectorSideEffect("github:issue.search"), "external_read");
    });

    it("classifies write capabilities as external_write", () => {
      assert.strictEqual(deriveConnectorSideEffect("post.publish"), "external_write");
      assert.strictEqual(deriveConnectorSideEffect("comment.reply"), "external_write");
      assert.strictEqual(deriveConnectorSideEffect("message.send"), "external_write");
      assert.strictEqual(deriveConnectorSideEffect("task.claim"), "external_write");
      assert.strictEqual(deriveConnectorSideEffect("agent.register"), "external_write");
    });

    it("classifies local-state capabilities as local_state", () => {
      assert.strictEqual(deriveConnectorSideEffect("agent.heartbeat"), "local_state");
      assert.strictEqual(deriveConnectorSideEffect("status.update"), "local_state");
    });

    it("classifies unknown capabilities as unknown", () => {
      assert.strictEqual(deriveConnectorSideEffect("mystery.action"), "unknown");
      assert.strictEqual(deriveConnectorSideEffect("platform.unknown"), "unknown");
    });
  });

  describe("assembleCapabilityAffordancePosture", () => {
    it("assembles posture with derived side effect", () => {
      const posture = assembleCapabilityAffordancePosture(
        "moltbook",
        "feed.read",
        "ready",
        "closed",
      );
      assert.strictEqual(posture.connectorId, "moltbook");
      assert.strictEqual(posture.capabilityId, "feed.read");
      assert.strictEqual(posture.sideEffectClass, "external_read");
      assert.strictEqual(posture.authStatus, "ready");
      assert.strictEqual(posture.breakerStatus, "closed");
    });

    it("preserves breaker-open posture", () => {
      const posture = assembleCapabilityAffordancePosture(
        "instreet",
        "post.publish",
        "needs_auth",
        "open",
      );
      assert.strictEqual(posture.sideEffectClass, "external_write");
      assert.strictEqual(posture.authStatus, "needs_auth");
      assert.strictEqual(posture.breakerStatus, "open");
    });
  });

  describe("buildSideEffectAwareAffordanceMap", () => {
    it("groups postures by connector then capability", () => {
      const postures: CapabilityAffordancePosture[] = [
        assembleCapabilityAffordancePosture("moltbook", "feed.read", "ready", "closed"),
        assembleCapabilityAffordancePosture("moltbook", "post.publish", "ready", "closed"),
        assembleCapabilityAffordancePosture("instreet", "work.discover", "needs_auth", "half_open"),
      ];
      const map = buildSideEffectAwareAffordanceMap(postures);
      assert.ok(map.moltbook);
      assert.ok(map.moltbook["feed.read"]);
      assert.ok(map.moltbook["post.publish"]);
      assert.ok(map.instreet);
      assert.ok(map.instreet["work.discover"]);
      assert.strictEqual(map.moltbook["feed.read"].sideEffectClass, "external_read");
      assert.strictEqual(map.moltbook["post.publish"].sideEffectClass, "external_write");
    });
  });

  describe("lookupSideEffectPosture", () => {
    it("returns posture for known connector+capability", () => {
      const postures: CapabilityAffordancePosture[] = [
        assembleCapabilityAffordancePosture("moltbook", "feed.read", "ready", "closed"),
      ];
      const map = buildSideEffectAwareAffordanceMap(postures);
      const found = lookupSideEffectPosture(map, "moltbook", "feed.read");
      assert.ok(found);
      assert.strictEqual(found!.sideEffectClass, "external_read");
    });

    it("returns undefined for unknown connector", () => {
      const map = buildSideEffectAwareAffordanceMap([]);
      const found = lookupSideEffectPosture(map, "unknown", "feed.read");
      assert.strictEqual(found, undefined);
    });

    it("returns undefined for unknown capability", () => {
      const postures: CapabilityAffordancePosture[] = [
        assembleCapabilityAffordancePosture("moltbook", "feed.read", "ready", "closed"),
      ];
      const map = buildSideEffectAwareAffordanceMap(postures);
      const found = lookupSideEffectPosture(map, "moltbook", "unknown");
      assert.strictEqual(found, undefined);
    });
  });

  describe("policy-facing helpers", () => {
    it("isWriteSideEffect identifies external_write", () => {
      assert.strictEqual(isWriteSideEffect("external_write"), true);
      assert.strictEqual(isWriteSideEffect("external_read"), false);
      assert.strictEqual(isWriteSideEffect("local_state"), false);
      assert.strictEqual(isWriteSideEffect("unknown"), false);
    });

    it("isReadSideEffect identifies external_read", () => {
      assert.strictEqual(isReadSideEffect("external_read"), true);
      assert.strictEqual(isReadSideEffect("external_write"), false);
    });

    it("isLocalStateSideEffect identifies local_state", () => {
      assert.strictEqual(isLocalStateSideEffect("local_state"), true);
      assert.strictEqual(isLocalStateSideEffect("external_write"), false);
    });

    it("isUnknownSideEffect identifies unknown", () => {
      assert.strictEqual(isUnknownSideEffect("unknown"), true);
      assert.strictEqual(isUnknownSideEffect("external_write"), false);
    });

    it("effectiveActionSideEffectClass returns input unchanged", () => {
      assert.strictEqual(effectiveActionSideEffectClass("external_write"), "external_write");
      assert.strictEqual(effectiveActionSideEffectClass("unknown"), "unknown");
    });
  });
});
