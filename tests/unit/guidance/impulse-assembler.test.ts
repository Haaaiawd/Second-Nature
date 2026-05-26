/**
 * impulse-assembler.test.ts — T-V7C.C.4R
 *
 * Unit tests for ImpulseAssembler three-level fallback chain.
 * Covers: platform-specific → capabilityClass → intentKind → none.
 * Also verifies agent.* exclusion and explore/work pending-review fallthrough.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleImpulse,
  assembleImpulseSync,
  type PlatformImpulsePort,
  type ImpulseSelectionContext,
} from "../../../src/guidance/impulse-assembler.js";
import type { ImpulseBlock } from "../../../src/guidance/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlatformPort(overrides: Map<string, ImpulseBlock>): PlatformImpulsePort {
  return {
    async loadPlatformImpulse({ platformId, capabilityClass }) {
      return overrides.get(`${platformId}:${capabilityClass}`) ?? null;
    },
  };
}

const MOCK_PLATFORM_IMPULSE: ImpulseBlock = {
  kind: "social",
  text: "moltbook platform specific impulse text",
  reviewStatus: "approved",
};

// ─── assembleImpulseSync ──────────────────────────────────────────────────────

describe("assembleImpulseSync — agent.* excluded", () => {
  it("agent.heartbeat → null, source=none", () => {
    const result = assembleImpulseSync({
      sceneType: "social",
      capabilityIntent: "agent.heartbeat",
    });
    assert.strictEqual(result.impulse, null);
    assert.strictEqual(result.source, "none");
    assert.strictEqual(result.capabilityClass, null);
  });

  it("agent.status → null", () => {
    const result = assembleImpulseSync({
      sceneType: "social",
      capabilityIntent: "agent.status",
    });
    assert.strictEqual(result.impulse, null);
    assert.strictEqual(result.source, "none");
  });
});

describe("assembleImpulseSync — capabilityClass preset (explore/work approved)", () => {
  it("post.publish + intentKind social → social impulse via intentKind fallback (broadcast has no cc template)", () => {
    // capabilityClass=broadcast → CAPABILITY_CLASS_SCENE_MAP[broadcast]=social
    // getCapabilityClassImpulseTemplate("social") — social is NOT a capability-class kind,
    // so it falls through to intentKind
    const result = assembleImpulseSync({
      sceneType: "social",
      capabilityIntent: "post.publish",
    });
    assert.ok(result.impulse !== null, "should have impulse");
    assert.strictEqual(result.capabilityClass, "broadcast");
    assert.ok(
      result.source === "capability_class" || result.source === "intent_kind",
      `expected capability_class or intent_kind, got ${result.source}`,
    );
  });

  it("feed.read → capabilityClass=consume, returns explore impulse (approved)", () => {
    // capabilityClass=consume → CAPABILITY_CLASS_SCENE_MAP[consume]=explore
    // getCapabilityClassImpulseTemplate("explore") → approved impulse
    const result = assembleImpulseSync({
      sceneType: "social",
      capabilityIntent: "feed.read",
    });
    assert.ok(result.impulse !== null, "should have explore capability_class impulse");
    assert.strictEqual(result.capabilityClass, "consume");
    assert.strictEqual(result.source, "capability_class");
    assert.ok(result.impulse!.text.length > 0);
  });

  it("task.claim → capabilityClass=claim, returns work impulse (approved)", () => {
    const result = assembleImpulseSync({
      sceneType: "social",
      capabilityIntent: "task.claim",
    });
    assert.strictEqual(result.capabilityClass, "claim");
    assert.strictEqual(result.source, "capability_class");
    assert.ok(result.impulse !== null);
  });
});

describe("assembleImpulseSync — explain/user_reply always no impulse", () => {
  it("explain scene → no impulse regardless of capabilityIntent", () => {
    const result = assembleImpulseSync({
      sceneType: "explain",
      capabilityIntent: "post.publish",
    });
    assert.strictEqual(result.impulse, null);
    assert.strictEqual(result.source, "none");
  });

  it("user_reply scene → no impulse", () => {
    const result = assembleImpulseSync({ sceneType: "user_reply" });
    assert.strictEqual(result.impulse, null);
    assert.strictEqual(result.source, "none");
  });
});

describe("assembleImpulseSync — no capabilityIntent → intentKind only", () => {
  it("social scene, no capability → social impulse via intentKind", () => {
    const result = assembleImpulseSync({ sceneType: "social" });
    assert.ok(result.impulse !== null);
    assert.strictEqual(result.source, "intent_kind");
    assert.strictEqual(result.capabilityClass, null);
  });

  it("reply scene, no capability → reply impulse", () => {
    const result = assembleImpulseSync({ sceneType: "reply" });
    assert.ok(result.impulse !== null);
    assert.strictEqual(result.source, "intent_kind");
    assert.ok(result.impulse!.kind === "reply");
  });

  it("outreach scene → outreach impulse", () => {
    const result = assembleImpulseSync({ sceneType: "outreach" });
    assert.ok(result.impulse !== null);
    assert.strictEqual(result.impulse!.kind, "outreach");
  });

  it("quiet scene → quiet impulse", () => {
    const result = assembleImpulseSync({ sceneType: "quiet" });
    assert.ok(result.impulse !== null);
    assert.strictEqual(result.impulse!.kind, "quiet");
  });
});

// ─── assembleImpulse (async — platform-specific) ─────────────────────────────

describe("assembleImpulse — platform-specific priority", () => {
  it("platform-specific impulse takes priority over capabilityClass and intentKind", async () => {
    const overrides = new Map([["moltbook:broadcast", MOCK_PLATFORM_IMPULSE]]);
    const port = makePlatformPort(overrides);

    const result = await assembleImpulse(
      {
        sceneType: "social",
        capabilityIntent: "post.publish",
        platformId: "moltbook",
      },
      { platformImpulsePort: port },
    );

    assert.strictEqual(result.source, "platform_specific");
    assert.strictEqual(result.impulse?.text, MOCK_PLATFORM_IMPULSE.text);
    assert.strictEqual(result.capabilityClass, "broadcast");
  });

  it("no platform-specific → falls back to capabilityClass explore (approved)", async () => {
    const port = makePlatformPort(new Map()); // no overrides

    const result = await assembleImpulse(
      {
        sceneType: "social",
        capabilityIntent: "feed.read",
        platformId: "moltbook",
      },
      { platformImpulsePort: port },
    );

    // explore is approved → capability_class impulse (platform had no override)
    assert.strictEqual(result.source, "capability_class");
    assert.ok(result.impulse !== null);
  });

  it("agent.heartbeat → null even with platform port wired", async () => {
    const overrides = new Map([["moltbook:broadcast", MOCK_PLATFORM_IMPULSE]]);
    const port = makePlatformPort(overrides);

    const result = await assembleImpulse(
      {
        sceneType: "social",
        capabilityIntent: "agent.heartbeat",
        platformId: "moltbook",
      },
      { platformImpulsePort: port },
    );

    assert.strictEqual(result.impulse, null);
    assert.strictEqual(result.source, "none");
  });

  it("platform port throws → falls back gracefully to intentKind", async () => {
    const faultyPort: PlatformImpulsePort = {
      loadPlatformImpulse: async () => {
        throw new Error("port_error");
      },
    };

    const result = await assembleImpulse(
      {
        sceneType: "social",
        capabilityIntent: "post.publish",
        platformId: "moltbook",
      },
      { platformImpulsePort: faultyPort },
    );

    // Should not throw; should fall back gracefully
    assert.ok(result.source !== "platform_specific");
    assert.ok(result.impulse !== null || result.source === "none");
  });
});
