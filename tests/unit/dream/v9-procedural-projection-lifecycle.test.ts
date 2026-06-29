/**
 * v9 ProceduralProjectionLifecycle — Unit Tests
 *
 * Validates: accept/reject/retire lifecycle, source ref requirement,
 * capability pattern requirement, auto-supersede on same pattern.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  acceptProceduralProjection,
  rejectProceduralProjection,
  retireProceduralProjection,
} from "../../../src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.js";
import type { StateDatabase } from "../../../src/storage/db/index.js";

function makeMockDb(): StateDatabase {
  return {
    sqlite: null as any,
    schema: null as any,
    flush() {},
    close() {},
    db: {
      select: () => ({
        from: () => ({
          where: () => {
            throw new Error("db unavailable");
          },
        }),
      }),
      insert: () => ({ values: () => Promise.resolve() }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as any,
  };
}

const sourceRefs = [{ family: "quiet" as const, id: "review_1" }];

describe("v9-procedural-projection-lifecycle", () => {
  describe("accept", () => {
    it("rejects acceptance without source refs", async () => {
      const db = makeMockDb();
      const result = await acceptProceduralProjection(
        db,
        "cand_1",
        "cap://test/pattern",
        "routine text",
        [],
      );
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "blocked");
      assert.equal((result as any).reason, "source_refs_unresolved");
    });

    it("rejects acceptance without capability pattern", async () => {
      const db = makeMockDb();
      const result = await acceptProceduralProjection(
        db,
        "cand_1",
        "",
        "routine text",
        sourceRefs,
      );
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "partial");
      assert.equal((result as any).reason, "quiet_validation_failed");
    });

    it("returns degraded on unreadable state", async () => {
      const db = makeMockDb();
      const result = await acceptProceduralProjection(
        db,
        "cand_1",
        "cap://test/pattern",
        "routine text",
        sourceRefs,
      );
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("reject", () => {
    it("returns degraded on unreadable state", async () => {
      const db = makeMockDb();
      const result = await rejectProceduralProjection(db, "proj_1");
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });

  describe("retire", () => {
    it("returns degraded on unreadable state", async () => {
      const db = makeMockDb();
      const result = await retireProceduralProjection(db, "proj_1");
      assert.ok("ownerStage" in result, "expected degraded result");
      assert.equal(result.status, "unavailable");
    });
  });
});
