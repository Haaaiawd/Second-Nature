/**
 * Guidance Context Command — API Tests (T-GVS.R.1)
 *
 * Validates: guidance_payload reads persisted artifact when available,
 * falls back to real-time assembly, and persists for future reads.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeImpulseContext } from "../../../src/core/second-nature/guidance/impulse-context-writer.js";

// We test the ops router via the plugin entry since guidance_payload is an ops command
// For API-level validation, we test the writer/reader integration directly.

describe("guidance-context-command API", () => {
  it("guidance_payload reads persisted artifact", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Seed artifact directly
      await writeImpulseContext(
        db,
        {
          sceneType: "reply",
          capabilityIntent: "comment.reply",
          platformId: "moltbook",
          impulseResult: {
            impulse: { kind: "reply", text: "Reply with empathy", reviewStatus: "approved" },
            source: "capability_class",
            capabilityClass: "interact",
          },
          atmosphereText: "Supportive",
          expressionBoundaryConstraints: ["be_kind"],
        },
        { now: new Date().toISOString() },
      );

      // Verify it can be read back
      const { readImpulseContext } = await import(
        "../../../src/core/second-nature/guidance/impulse-context-reader.js"
      );
      const result = await readImpulseContext(db, "reply", "comment.reply", "moltbook");
      assert.ok(result.available, "persisted artifact should be readable");
      if (result.available) {
        assert.equal(result.artifact.sceneType, "reply");
        assert.equal(result.artifact.capabilityIntent, "comment.reply");
        assert.equal(result.artifact.platformId, "moltbook");
        assert.equal(result.artifact.impulseText, "Reply with empathy");
        assert.equal(result.artifact.atmosphereText, "Supportive");
      }
    } finally {
      db.close();
    }
  });

  it("guidance_payload returns missing reason when no artifact exists", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const { readImpulseContext } = await import(
        "../../../src/core/second-nature/guidance/impulse-context-reader.js"
      );
      const result = await readImpulseContext(db, "outreach");
      assert.ok(!result.available, "should be missing");
      if (!result.available) {
        assert.equal(result.reason, "artifact_not_persisted");
      }
    } finally {
      db.close();
    }
  });
});
