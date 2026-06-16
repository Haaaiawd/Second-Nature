import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  legacyKindFromSourceRef,
  sourceRefFamilyFromLegacyKind,
  toCanonicalSourceRef,
} from "../../../src/shared/source-ref-compat.js";

describe("source-ref compatibility adapters", () => {
  it("maps every legacy kind into an allowed canonical family", () => {
    assert.equal(sourceRefFamilyFromLegacyKind("platform_item"), "evidence");
    assert.equal(sourceRefFamilyFromLegacyKind("user_anchor"), "evidence");
    assert.equal(sourceRefFamilyFromLegacyKind("connector_result"), "connector_result");
    assert.equal(sourceRefFamilyFromLegacyKind("decision_record"), "judgment");
    assert.equal(sourceRefFamilyFromLegacyKind("workspace_artifact"), "audit");
    assert.equal(sourceRefFamilyFromLegacyKind("host_report"), "audit");
    assert.equal(sourceRefFamilyFromLegacyKind("fallback_artifact"), "audit");
  });

  it("preserves user anchors when canonical refs cross back to legacy guidance", () => {
    const ref = toCanonicalSourceRef({
      id: "anchor:USER.md",
      kind: "user_anchor",
      uri: "D:/workspace/USER.md",
    });

    assert.equal(ref.family, "evidence");
    assert.equal(legacyKindFromSourceRef(ref), "user_anchor");
  });

  it("keeps platform evidence distinct from user anchors", () => {
    const ref = toCanonicalSourceRef({
      id: "post-1",
      kind: "platform_item",
      uri: "platform://moltbook/item/post-1",
    });

    assert.equal(legacyKindFromSourceRef(ref), "platform_item");
  });
});
