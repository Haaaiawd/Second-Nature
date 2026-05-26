/**
 * v7c-guidance-chain.test.ts — T-V7C.C.4R
 *
 * Integration tests for the full guidance chain:
 * 1. assembleGuidance with capabilityIntent — dual-axis impulse selection
 * 2. guidance_payload ops command — returns impulseText + atmosphereText
 * 3. generateGuidanceDraft — buildDraftText returns Chinese content
 * 4. agent.* exclusion through full assembleGuidance path
 *
 * Dependencies: guidance-assembler, impulse-assembler, template-registry, ops-router
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleGuidance } from "../../../src/guidance/guidance-assembler.js";
import { generateGuidanceDraft } from "../../../src/guidance/guidance-draft-service.js";
import { createOpsRouter } from "../../../src/cli/ops/ops-router.js";

// ─── assembleGuidance: capabilityIntent integration ──────────────────────────

describe("assembleGuidance with capabilityIntent (T-V7C.C.4R)", () => {
  it("post.publish + social → impulse is not null (social or broadcast-derived)", async () => {
    const result = await assembleGuidance({
      sceneContext: {
        sceneType: "social",
        mode: "active",
        capabilityIntent: "post.publish",
      },
    });

    assert.ok(!("available" in result), "expected GuidancePayload, got GuidanceUnavailable");
    const payload = result as Awaited<ReturnType<typeof assembleGuidance>> & { impulses: unknown[] };
    assert.ok("impulses" in payload);
    // social scene with broadcast capability should have an impulse
    assert.ok(payload.impulses.length > 0, "expected at least one impulse for post.publish social scene");
  });

  it("feed.read + social → explore impulse via capabilityClass (approved)", async () => {
    const result = await assembleGuidance({
      sceneContext: {
        sceneType: "social",
        mode: "active",
        capabilityIntent: "feed.read",
      },
    });

    assert.ok(!("available" in result));
    const payload = result as { impulses: Array<{ text: string; reviewStatus: string }> };
    // explore is approved → capability_class impulse returned
    assert.ok(payload.impulses.length > 0, "should have explore capability_class impulse");
    assert.strictEqual(payload.impulses[0]!.reviewStatus, "approved");
  });

  it("agent.heartbeat → no impulse injected", async () => {
    const result = await assembleGuidance({
      sceneContext: {
        sceneType: "social",
        mode: "active",
        capabilityIntent: "agent.heartbeat",
      },
    });

    assert.ok(!("available" in result));
    const payload = result as { impulses: unknown[] };
    // agent.* excluded → impulse assembler returns null → empty impulses array
    assert.strictEqual(payload.impulses.length, 0, "agent.heartbeat must not inject impulse");
  });

  it("explain scene → no impulse regardless of capability", async () => {
    const result = await assembleGuidance({
      sceneContext: {
        sceneType: "explain",
        mode: "active",
        capabilityIntent: "post.publish",
      },
    });

    assert.ok(!("available" in result));
    const payload = result as { impulses: unknown[] };
    assert.strictEqual(payload.impulses.length, 0);
  });

  it("atmosphere text is Chinese and non-empty for any scene", async () => {
    const result = await assembleGuidance({
      sceneContext: { sceneType: "social", mode: "active" },
    });

    assert.ok(!("available" in result));
    const payload = result as { atmosphere?: { text: string } };
    assert.ok(payload.atmosphere?.text.length, "atmosphere text must be non-empty");
    // Basic sanity: contains Chinese characters (not English placeholder)
    const hasChinese = /[\u4e00-\u9fff]/.test(payload.atmosphere!.text);
    assert.ok(hasChinese, "atmosphere text must contain Chinese content");
  });
});

// ─── generateGuidanceDraft: Chinese text ─────────────────────────────────────

describe("generateGuidanceDraft — Chinese buildDraftText (T-V7C.C.4R)", () => {
  const mockClaim = {
    id: "c1",
    text: "有趣的技术分享",
    sourceRefs: [{ id: "sr:1", kind: "workspace_artifact" as const, uri: "artifact://exp:1" }],
  };

  it("outreach scene → Chinese prefix text", async () => {
    const result = await generateGuidanceDraft(
      {
        requestId: "req:1",
        sceneKind: "outreach",
        evidencePackRef: "pack:1",
        relationshipContextRef: "rel:1",
        requestedAt: new Date().toISOString(),
      },
      {
        evidencePort: {
          loadEvidencePack: async () => ({ claims: [mockClaim] }),
        },
      },
    );

    assert.ok(result.draft, "should produce a draft");
    const hasChinese = /[\u4e00-\u9fff]/.test(result.draft!.text);
    assert.ok(hasChinese, `outreach draft text must be Chinese, got: ${result.draft!.text}`);
    assert.ok(
      result.draft!.text.includes("想跟你分享") || result.draft!.text.includes("正好碰到了"),
      `expected Chinese outreach text, got: ${result.draft!.text}`,
    );
  });

  it("follow_up scene → Chinese prefix text", async () => {
    const result = await generateGuidanceDraft(
      {
        requestId: "req:2",
        sceneKind: "follow_up",
        evidencePackRef: "pack:2",
        relationshipContextRef: "rel:2",
        requestedAt: new Date().toISOString(),
      },
      {
        evidencePort: {
          loadEvidencePack: async () => ({ claims: [mockClaim] }),
        },
      },
    );

    assert.ok(result.draft);
    assert.ok(result.draft!.text.includes("接着上次聊的"), `expected follow_up text, got: ${result.draft!.text}`);
  });

  it("reconnect scene → Chinese prefix text", async () => {
    const result = await generateGuidanceDraft(
      {
        requestId: "req:3",
        sceneKind: "reconnect",
        evidencePackRef: "pack:3",
        relationshipContextRef: "rel:3",
        requestedAt: new Date().toISOString(),
      },
      {
        evidencePort: {
          loadEvidencePack: async () => ({ claims: [mockClaim] }),
        },
      },
    );

    assert.ok(result.draft);
    assert.ok(result.draft!.text.includes("好久不见"), `expected reconnect text, got: ${result.draft!.text}`);
  });
});

// ─── guidance_payload ops command ────────────────────────────────────────────

describe("ops command: guidance_payload (T-V7C.C.4R)", () => {
  function makeRouter() {
    return createOpsRouter({ runtimeAvailable: false });
  }

  it("social + post.publish → returns impulseText + atmosphereText", async () => {
    const router = makeRouter();
    const result = await router.dispatch("guidance_payload", {
      sceneType: "social",
      capabilityIntent: "post.publish",
    });

    assert.ok(typeof result === "object" && result !== null);
    const envelope = result as {
      ok: boolean;
      data?: {
        impulseText: string | null;
        atmosphereText: string;
        capabilityClass: string | null;
        impulseSource: string;
      };
    };
    assert.ok(envelope.ok, `expected ok=true, got: ${JSON.stringify(result)}`);
    assert.ok(envelope.data?.atmosphereText.length, "atmosphereText must be non-empty");
    assert.ok(envelope.data?.impulseText !== undefined, "impulseText field must exist");
    assert.strictEqual(envelope.data?.capabilityClass, "broadcast");
  });

  it("agent.heartbeat → impulseText=null, source=none", async () => {
    const router = makeRouter();
    const result = await router.dispatch("guidance_payload", {
      sceneType: "social",
      capabilityIntent: "agent.heartbeat",
    });

    const envelope = result as { ok: boolean; data?: { impulseText: string | null; impulseSource: string } };
    assert.ok(envelope.ok);
    assert.strictEqual(envelope.data?.impulseText, null);
    assert.strictEqual(envelope.data?.impulseSource, "none");
  });

  it("feed.read → capabilityClass=consume, returns explore impulse (capability_class)", async () => {
    const router = makeRouter();
    const result = await router.dispatch("guidance_payload", {
      sceneType: "social",
      capabilityIntent: "feed.read",
    });

    const envelope = result as { ok: boolean; data?: { capabilityClass: string; impulseSource: string; impulseText: string | null } };
    assert.ok(envelope.ok);
    assert.strictEqual(envelope.data?.capabilityClass, "consume");
    // explore is approved → capability_class impulse
    assert.strictEqual(envelope.data?.impulseSource, "capability_class");
    assert.ok(envelope.data?.impulseText !== null, "should have explore impulse text");
  });

  it("invalid sceneType → ok=false with INVALID_SCENE_TYPE error", async () => {
    const router = makeRouter();
    const result = await router.dispatch("guidance_payload", {
      sceneType: "nonexistent_scene",
    });

    const envelope = result as { ok: boolean; error?: { code: string } };
    assert.strictEqual(envelope.ok, false);
    assert.strictEqual(envelope.error?.code, "INVALID_SCENE_TYPE");
  });
});
