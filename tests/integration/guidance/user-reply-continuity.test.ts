import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLightReplyContinuity,
  isDirectUserReply,
  USER_REPLY_SCENE_TYPE,
} from "../../../src/core/second-nature/guidance/user-reply-continuity.js";
import type { PersonaCandidate } from "../../../src/guidance/index.js";

// ─── T6.1.1: User Reply Light Continuity Tests ──────────────────────────────

test("T6.1.1 buildLightReplyContinuity returns guidance without impulses", async () => {
  const result = await buildLightReplyContinuity({
    replyContext: {
      recentTone: "casual and thoughtful",
    },
  });

  assert.ok("scene" in result, "should return guidance payload");
  assert.ok("impulses" in result, "should have impulses field");
  assert.equal((result as any).impulses.length, 0, "should have NO impulses (key difference from platform reply)");
});

test("T6.1.1 buildLightReplyContinuity includes light atmosphere", async () => {
  const result = await buildLightReplyContinuity({
    replyContext: {
      recentTone: "casual and thoughtful",
    },
  });

  assert.ok("atmosphere" in result, "should have atmosphere");
  const atmosphere = (result as any).atmosphere;
  assert.ok(atmosphere.text.includes("语气"), "atmosphere should mention tone continuity");
  assert.ok(atmosphere.text.includes("casual and thoughtful"), "atmosphere should include recent tone reference");
});

test("T6.1.1 buildLightReplyContinuity includes persona reinforcement when candidates provided", async () => {
  const candidates: PersonaCandidate[] = [
    { id: "soul-1", source: "SOUL", text: "I value authenticity", tags: ["authenticity"] },
    { id: "user-1", source: "USER", text: "User prefers concise replies", tags: ["preference"] },
  ];

  const result = await buildLightReplyContinuity({
    replyContext: {},
    personaCandidates: candidates,
  });

  assert.ok("personaReinforcement" in result, "should have persona reinforcement");
  // Note: selectPersonaSnippets may return 0-2 snippets depending on scene matching
  // The key is that the path was attempted, not the exact count
});

test("T6.1.1 buildLightReplyContinuity does NOT include platform reply impulses", async () => {
  const result = await buildLightReplyContinuity({
    replyContext: {},
  });

  const impulses = (result as any).impulses;
  assert.equal(impulses.length, 0, "should have no impulses - this is the key difference from platform reply scene");

  // Verify no reply-specific impulse text
  const impulseTexts = impulses.map((i: any) => i.text).join(" ");
  assert.ok(!impulseTexts.includes("reply"), "should not contain reply impulse text");
});

test("T6.1.1 buildLightReplyContinuity output guard focuses on tone consistency", async () => {
  const result = await buildLightReplyContinuity({
    replyContext: {},
  });

  assert.ok("outputGuard" in result, "should have output guard");
  const guard = (result as any).outputGuard;
  assert.ok(guard.constraints.length > 0, "should have constraints");
  assert.ok(
    guard.constraints.some((c: string) => c.includes("语气") || c.includes("连续性")),
    "guard should focus on tone/continuity"
  );
});

test("T6.1.1 isDirectUserReply classifies user_reply trigger correctly", () => {
  // Direct user reply
  assert.equal(
    isDirectUserReply({
      triggerSource: "user_reply",
      isPlatformReply: false,
      isExplicitTask: false,
    }),
    true,
    "should classify as direct user reply"
  );

  // Platform reply (not direct user reply)
  assert.equal(
    isDirectUserReply({
      triggerSource: "user_reply",
      isPlatformReply: true,
      isExplicitTask: false,
    }),
    false,
    "platform reply should not be direct user reply"
  );

  // Explicit task (not direct user reply)
  assert.equal(
    isDirectUserReply({
      triggerSource: "user_reply",
      isPlatformReply: false,
      isExplicitTask: true,
    }),
    false,
    "explicit task should not be direct user reply"
  );

  // Wrong trigger source
  assert.equal(
    isDirectUserReply({
      triggerSource: "heartbeat_bridge",
      isPlatformReply: false,
      isExplicitTask: false,
    }),
    false,
    "heartbeat trigger should not be direct user reply"
  );
});

test("T6.1.1 USER_REPLY_SCENE_TYPE is distinct from reply scene", () => {
  assert.equal(USER_REPLY_SCENE_TYPE, "user_reply");
  assert.notEqual(USER_REPLY_SCENE_TYPE, "reply");
});

test("T6.1.1 light continuity does not enter reply scene impulse system", async () => {
  const result = await buildLightReplyContinuity({
    replyContext: {},
  });

  // Verify the result is a guidance payload, not a reply scene result
  assert.ok("scene" in result, "should be guidance payload");
  assert.equal((result as any).scene.sceneType, "explain", "should use explain scene type, not reply");
  assert.equal((result as any).impulses.length, 0, "should not have reply scene impulses");
});
