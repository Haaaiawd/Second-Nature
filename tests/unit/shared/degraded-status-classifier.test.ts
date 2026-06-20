import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyDegradedStatus } from "../../../src/shared/degraded-status-classifier.js";
import type { V8ReasonCode } from "../../../src/shared/types/v8-contracts.js";

describe("degraded-status-classifier", () => {
  const cases: Array<{ reason: V8ReasonCode; expected: ReturnType<typeof classifyDegradedStatus> }> = [
    { reason: "evidence_batch_empty", expected: "empty" },
    { reason: "evidence_content_missing", expected: "empty" },
    { reason: "ingestion_empty", expected: "empty" },
    { reason: "quiet_empty_input", expected: "empty" },
    { reason: "source_refs_unresolved", expected: "blocked" },
    { reason: "proposal_missing_source_refs", expected: "blocked" },
    { reason: "dream_blocked_redaction", expected: "blocked" },
    { reason: "state_unreadable", expected: "unavailable" },
    { reason: "execution_unavailable", expected: "unavailable" },
    { reason: "guidance_unavailable", expected: "unavailable" },
    { reason: "policy_denied_high_risk", expected: "unsafe" },
    { reason: "policy_denied_breaker_open", expected: "unsafe" },
    { reason: "evidence_batch_truncated", expected: "partial" },
    { reason: "perception_rules_only", expected: "partial" },
    { reason: "closure_failed", expected: "unavailable" },
  ];

  for (const { reason, expected } of cases) {
    it(`classifies ${reason} as ${expected}`, () => {
      assert.equal(classifyDegradedStatus(reason), expected);
    });
  }
});
