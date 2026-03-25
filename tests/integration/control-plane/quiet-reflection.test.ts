import test from "node:test";
import assert from "node:assert/strict";

import { runQuietPipeline, runNarrativeReflection } from "../../../src/core/second-nature/index.js";

test("quiet pipeline distinguishes daily memory curation from compaction/pruning", () => {
  const output = runQuietPipeline({
    quietState: {
      mode: "quiet",
      reflectionDebt: 1,
      missedReflectionCount: 0,
    },
    bundle: {
      journalEntries: [
        { id: "j1", content: "browse", timestamp: "2026-03-25T01:00:00.000Z" },
      ],
      dailyReports: [
        { id: "r1", summary: "daily report", highlights: ["h1"], sources: ["j1"] },
      ],
    },
  });

  assert.equal(output.shouldRunReflection, true);
  assert.ok(output.curation.sourceRefs.includes("j1"));
  assert.ok(output.curation.sourceRefs.includes("r1"));
  assert.ok(output.curation.excludedCompactionArtifacts.includes("session_compaction"));
  assert.ok(output.curation.excludedCompactionArtifacts.includes("context_pruning"));
});

test("narrative reflection enforces source-backed claim-level contract", async () => {
  const result = await runNarrativeReflection(
    {
      async loadQuietInputs() {
        return { sourceRefs: ["j1", "r1"] };
      },
      async generateNarrativeReflection() {
        return {
          summary: "reflection summary",
          modelEvalRef: "eval-1",
          claims: [
            { text: "claim-1", sourceRefs: ["j1"], claimType: "fact" as const },
            { text: "claim-2", sourceRefs: ["r1"], claimType: "inference" as const },
          ],
          proposedWrites: [
            { targetAssetId: "SOUL.md", content: "x", sourceRefs: ["j1"] },
            { targetAssetId: "USER.md", content: "y", sourceRefs: [] },
          ],
        };
      },
      filterAllowedWrites(writes) {
        return writes;
      },
    },
    { lookbackDays: 1 }
  );

  assert.equal(result.unsupportedClaimCount, 0);
  assert.equal(result.sourceCoverageRatio, 1);
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0]?.targetAssetId, "SOUL.md");
});

test("narrative reflection rejects unsupported claims", async () => {
  await assert.rejects(
    () =>
      runNarrativeReflection(
        {
          async loadQuietInputs() {
            return { sourceRefs: ["j1"] };
          },
          async generateNarrativeReflection() {
            return {
              summary: "reflection summary",
              modelEvalRef: "eval-2",
              claims: [
                { text: "claim-unsupported", sourceRefs: [], claimType: "fact" as const },
              ],
              proposedWrites: [],
            };
          },
          filterAllowedWrites(writes) {
            return writes;
          },
        },
        { lookbackDays: 1 }
      ),
    /reflection_unsupported_claims/
  );
});
