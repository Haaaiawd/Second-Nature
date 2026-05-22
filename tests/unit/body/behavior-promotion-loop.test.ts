/**
 * BehaviorPromotionLoop tests — T-BTS.C.3
 *
 * Coverage:
 * - submitPromotion creates candidate
 * - approvePromotion transitions candidate→approved
 * - approvePromotion is idempotent
 * - rejectPromotion transitions candidate→rejected with reason
 * - rejected entry cannot be approved
 * - loadPromotion round-trip
 * - listPromotions filters by status
 * - expireStaleCandidates transitions expired candidates
 * - expired entry cannot be approved
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { createBehaviorPromotionLoop } from "../../../src/core/second-nature/body/behavior-promotion/behavior-promotion-loop.js";

describe("BehaviorPromotionLoop", () => {
  it("submitPromotion creates candidate", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    const p = await loop.submitPromotion({
      promotionId: "promo-1",
      behaviorKind: "greeting_style",
      description: "Use a warmer greeting",
    });

    assert.strictEqual(p.status, "candidate");
    assert.strictEqual(p.behaviorKind, "greeting_style");
    assert(p.expiresAt > p.submittedAt);
  });

  it("approvePromotion transitions candidate to approved", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "promo-2",
      behaviorKind: "tone",
      description: "More casual",
    });
    const approved = await loop.approvePromotion("promo-2");
    assert.strictEqual(approved.status, "approved");
    assert(approved.decidedAt !== undefined);
  });

  it("approvePromotion is idempotent", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "promo-3",
      behaviorKind: "tone",
      description: "More casual",
    });
    const first = await loop.approvePromotion("promo-3");
    const second = await loop.approvePromotion("promo-3");
    assert.strictEqual(second.status, "approved");
    assert.strictEqual(second.decidedAt, first.decidedAt);
  });

  it("rejectPromotion transitions candidate to rejected", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "promo-4",
      behaviorKind: "emoji",
      description: "Add emojis",
    });
    const rejected = await loop.rejectPromotion("promo-4", "not aligned with brand");
    assert.strictEqual(rejected.status, "rejected");
    assert.strictEqual(rejected.rejectReason, "not aligned with brand");
  });

  it("rejected entry cannot be approved", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "promo-5",
      behaviorKind: "emoji",
      description: "Add emojis",
    });
    await loop.rejectPromotion("promo-5", "no");
    await assert.rejects(
      loop.approvePromotion("promo-5"),
      /promotion_immutable/,
    );
  });

  it("loadPromotion round-trip", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "promo-6",
      behaviorKind: "timing",
      description: "Reply faster",
    });
    const loaded = await loop.loadPromotion("promo-6");
    assert.strictEqual(loaded!.status, "candidate");
    assert.strictEqual(loaded!.behaviorKind, "timing");
  });

  it("listPromotions filters by status", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({ promotionId: "a1", behaviorKind: "a", description: "a" });
    await loop.submitPromotion({ promotionId: "a2", behaviorKind: "a", description: "a" });
    await loop.approvePromotion("a1");

    const approved = await loop.listPromotions("approved");
    const candidates = await loop.listPromotions("candidate");
    assert.strictEqual(approved.length, 1);
    assert.strictEqual(candidates.length, 1);
  });

  it("expireStaleCandidates transitions expired candidates", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "old-1",
      behaviorKind: "x",
      description: "x",
    });

    // Force expiration by backdating in DB
    db.sqlite.run(
      `UPDATE behavior_promotion SET expires_at = ? WHERE promotion_id = ?`,
      ["2020-01-01T00:00:00Z", "old-1"],
    );

    const count = await loop.expireStaleCandidates();
    assert.strictEqual(count, 1);

    const loaded = await loop.loadPromotion("old-1");
    assert.strictEqual(loaded!.status, "expired");
  });

  it("expired entry cannot be approved", async () => {
    const db = createStateDatabase(":memory:");
    const loop = createBehaviorPromotionLoop(db);

    await loop.submitPromotion({
      promotionId: "old-2",
      behaviorKind: "x",
      description: "x",
    });
    db.sqlite.run(
      `UPDATE behavior_promotion SET expires_at = ? WHERE promotion_id = ?`,
      ["2020-01-01T00:00:00Z", "old-2"],
    );
    await loop.expireStaleCandidates();

    await assert.rejects(
      loop.approvePromotion("old-2"),
      /promotion_immutable/,
    );
  });
});
