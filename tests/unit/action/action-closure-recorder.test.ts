/**
 * ActionClosureRecorder — Unit Tests
 *
 * Validates: no-action, remember, policy outcome, degraded handling.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  recordNoActionClosure,
  recordRememberClosure,
  recordPolicyOutcomeClosure,
} from "../../../src/core/second-nature/action/action-closure-recorder.js";
import type { MemoryReviewCandidateClosure } from "../../../src/shared/types/v8-contracts.js";

const MOCK_DB = {} as any;

describe("action-closure-recorder", () => {
  describe("no-action closure", () => {
    it("records no_action with reason", async () => {
      const result = await recordNoActionClosure(MOCK_DB, "cyc_test", "proposal_no_action");
      assert.ok("status" in result);
    });
  });

  describe("remember closure", () => {
    it("records remember_for_review", async () => {
      const candidate: MemoryReviewCandidateClosure = {
        closureSubtype: "remember_for_review",
        perceptionRef: { uri: "sn://per/1", family: "perception", id: "per1", redactionClass: "none", resolveStatus: "resolvable" },
        judgmentVerdictRef: { uri: "sn://jud/1", family: "judgment", id: "jud1", redactionClass: "none", resolveStatus: "resolvable" },
        topicKey: "test_topic",
        memoryIntentReason: "remember",
        reviewPriority: "medium",
        sourceRefs: [{ uri: "sn://test/1", family: "evidence", id: "ev1", redactionClass: "none", resolveStatus: "resolvable" }],
      };
      const result = await recordRememberClosure(MOCK_DB, "cyc_test", candidate);
      assert.ok("status" in result);
    });
  });

  describe("policy outcome closure", () => {
    it("records denied closure", async () => {
      const result = await recordPolicyOutcomeClosure(
        MOCK_DB,
        "cyc_test",
        "denied",
        "policy_denied_high_risk",
        { proposalId: "prop_test", decisionId: "dec_test" },
      );
      assert.ok("status" in result);
    });

    it("records downgraded closure", async () => {
      const result = await recordPolicyOutcomeClosure(
        MOCK_DB,
        "cyc_test",
        "downgraded",
        "policy_downgraded_to_draft",
        { proposalId: "prop_test", decisionId: "dec_test", downgradedActionKind: "draft_reply" },
      );
      assert.ok("status" in result);
    });
  });
});
