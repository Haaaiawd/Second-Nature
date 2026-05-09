import test from "node:test";
import assert from "node:assert/strict";

import { writeQuietArtifact, calculateQuietSourceCoverage } from "../../../src/storage/quiet/quiet-artifact-writer.js";
import type { QuietArtifactWrite } from "../../../src/storage/quiet/quiet-artifact-types.js";
import type { SourceRef } from "../../../src/storage/life-evidence/types.js";

const sr = (id: string): SourceRef => ({
  id,
  kind: "platform_item",
  uri: `https://x/${id}`,
});

test("T4.4.1 narrative with fully backed facts passes and unsupportedClaims empty", () => {
  const input: QuietArtifactWrite = {
    day: "2026-05-02",
    kind: "narrative_reflection",
    title: "day",
    body: "reflection",
    claims: [
      { id: "c1", text: "did X", sourceRefs: [sr("s1")], claimType: "fact" },
      { id: "c2", text: "felt fine", sourceRefs: [], claimType: "emotion" },
    ],
    sourceRefs: [sr("s1")],
  };
  const ack = writeQuietArtifact(input);
  assert.ok(ack.artifactRef.uri.includes("narrative_reflection"));
  assert.equal(ack.sourceCoverage.unsupportedClaims.length, 0);
  assert.ok(ack.sourceCoverage.coverageRatio >= 0.51);
});

test("T4.4.1 factual claim without source ref is rejected", () => {
  const input: QuietArtifactWrite = {
    day: "2026-05-02",
    kind: "daily_report",
    title: "day",
    body: "report",
    claims: [{ id: "c-bad", text: "ungrounded fact", sourceRefs: [], claimType: "fact" }],
    sourceRefs: [sr("root")],
  };
  assert.throws(() => writeQuietArtifact(input), /quiet_artifact_unsupported_factual_claim/);
});

test("T4.4.1 empty_state allows empty sourceRefs", () => {
  const input: QuietArtifactWrite = {
    day: "2026-05-02",
    kind: "empty_state",
    title: "empty",
    body: "no evidence",
    claims: [],
    sourceRefs: [],
  };
  const ack = writeQuietArtifact(input);
  assert.equal(ack.sourceCoverage.coverageRatio, 1);
});

test("T4.4.1 factual refs not in evidence bundle → source coverage too low", () => {
  const input: QuietArtifactWrite = {
    day: "2026-05-02",
    kind: "daily_report",
    title: "low",
    body: "b",
    claims: [{ id: "a", text: "f1", sourceRefs: [sr("orphan")], claimType: "fact" }],
    sourceRefs: [sr("s1")],
  };
  assert.throws(() => writeQuietArtifact(input), /quiet_artifact_source_coverage_too_low/);
});

test("T4.4.1 calculateQuietSourceCoverage marks missing factual refs", () => {
  const cov = calculateQuietSourceCoverage([
    { id: "x", text: "t", sourceRefs: [], claimType: "fact" },
  ]);
  assert.equal(cov.coverageRatio, 0);
  assert.deepEqual(cov.unsupportedClaims, ["x"]);
});
