import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidencePack,
  selectInterestBasis,
  buildQuietNarrativeGuidance,
} from "../../../src/guidance/evidence-guidance.js";

test("T6.1.2 buildEvidencePack strict rejects unresolved uri", () => {
  const r = buildEvidencePack([{ id: "a", kind: "platform_item", uri: "" }], { policy: "strict" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reasons.includes("unresolved_source_refs"));
});

test("T6.1.2 buildEvidencePack lenient tolerates unresolved", () => {
  const r = buildEvidencePack(
    [
      { id: "a", kind: "platform_item", uri: "https://x" },
      { id: "b", kind: "platform_item", uri: "" },
    ],
    { policy: "lenient" },
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(r.pack.unresolvedIds.includes("b"));
});

test("T6.1.2 selectInterestBasis insufficient → evidence_only or unavailable", () => {
  assert.equal(
    selectInterestBasis({ staleness: "insufficient", confidence: 0, signalCount: 1 }),
    "evidence_only",
  );
  assert.equal(
    selectInterestBasis({ staleness: "insufficient", confidence: 0, signalCount: 0 }),
    "unavailable",
  );
});

test("T6.1.2 buildQuietNarrativeGuidance blocks unsupported claims", () => {
  const r = buildQuietNarrativeGuidance({
    interestBasis: "evidence_only",
    sourceCoverage: { coverageRatio: 1, unsupportedClaims: ["x"] },
    outline: [],
  });
  assert.equal(r.status, "unavailable");
});

test("T6.1.2 buildQuietNarrativeGuidance ready path", () => {
  const r = buildQuietNarrativeGuidance({
    interestBasis: "evidence_only",
    sourceCoverage: { coverageRatio: 0.9, unsupportedClaims: [] },
    outline: ["a", "b"],
  });
  assert.equal(r.status, "ready");
  if (r.status === "ready") assert.ok(r.hints.some((h) => h.startsWith("hint:")));
});
