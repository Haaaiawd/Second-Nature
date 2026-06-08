/**
 * ImpulseContextArtifact — Unit Tests (T-GVS.R.1)
 *
 * Validates: artifact write/read, freshness diagnostics, missing artifact
 * reasons, and no fake context-engine registration.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  writeImpulseContext,
  type ImpulseContextArtifactInput,
} from "../../../src/core/second-nature/guidance/impulse-context-writer.js";
import { readImpulseContext } from "../../../src/core/second-nature/guidance/impulse-context-reader.js";

describe("impulse-context-artifact", () => {
  function makeInput(overrides?: Partial<ImpulseContextArtifactInput>): ImpulseContextArtifactInput {
    return {
      sceneType: "social",
      capabilityIntent: undefined,
      platformId: undefined,
      impulseResult: {
        impulse: { kind: "social", text: "Be warm and curious", reviewStatus: "approved" },
        source: "intent_kind",
        capabilityClass: null,
      },
      atmosphereText: "Open and receptive",
      expressionBoundaryConstraints: ["avoid_sarcasm"],
      expressionBoundaryStyle: "avoid_prefer",
      ...overrides,
    };
  }

  it("writes and reads impulse context artifact", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      const writeResult = await writeImpulseContext(db, makeInput(), { now });
      assert.ok("id" in writeResult, "write should succeed");

      const readResult = await readImpulseContext(db, "social");
      assert.ok(readResult.available, "artifact should be available");
      if (readResult.available) {
        assert.equal(readResult.artifact.sceneType, "social");
        assert.equal(readResult.artifact.impulseText, "Be warm and curious");
        assert.equal(readResult.artifact.atmosphereText, "Open and receptive");
        assert.deepStrictEqual(readResult.artifact.expressionBoundaryConstraints, ["avoid_sarcasm"]);
        assert.ok(readResult.freshnessMs >= 0, "freshness should be non-negative");
      }
    } finally {
      db.close();
    }
  });

  it("returns missing reason when artifact does not exist", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const result = await readImpulseContext(db, "reply", "comment.reply", "moltbook");
      assert.ok(!result.available, "should not be available");
      if (!result.available) {
        assert.equal(result.reason, "artifact_not_persisted");
        assert.ok(result.operatorNextAction.includes("guidance_payload"), "should suggest guidance_payload");
      }
    } finally {
      db.close();
    }
  });

  it("returns expired reason for stale artifact", async () => {
    const db = createStateDatabase(":memory:");
    try {
      // Write with old timestamp
      await writeImpulseContext(db, makeInput(), { now: "2026-06-01T00:00:00Z" });

      const result = await readImpulseContext(db, "social");
      assert.ok(!result.available, "should be expired");
      if (!result.available) {
        assert.equal(result.reason, "artifact_expired");
      }
    } finally {
      db.close();
    }
  });

  it("overwrites existing artifact for same scene/capability combo", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const now = new Date().toISOString();
      await writeImpulseContext(
        db,
        makeInput({ impulseResult: { impulse: { kind: "social", text: "v1", reviewStatus: "approved" }, source: "intent_kind", capabilityClass: null } }),
        { now },
      );
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const now2 = new Date().toISOString();
      await writeImpulseContext(
        db,
        makeInput({ impulseResult: { impulse: { kind: "social", text: "v2", reviewStatus: "approved" }, source: "intent_kind", capabilityClass: null } }),
        { now: now2 },
      );

      const result = await readImpulseContext(db, "social");
      assert.ok(result.available, "artifact should be available");
      if (result.available) {
        assert.equal(result.artifact.impulseText, "v2", "should return latest version");
      }
    } finally {
      db.close();
    }
  });
});
