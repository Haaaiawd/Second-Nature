import test from "node:test";
import assert from "node:assert/strict";

import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";
const now = () => new Date().toISOString();

test("T5.2.1 integration: decision + delivery + coverage linked to same decisionId", () => {
  const rec = createLivedExperienceAuditRecorder();
  const decisionId = "dec-int-1";
  const traceId = "trace-int-1";
  rec.recordDecisionTrace({
    decisionId,
    traceId,
    runtimeScope: "rhythm",
    outcome: "delivery_unavailable",
    reasonCodes: ["target_none"],
    sourceRefs: [],
    createdAt: now(),
  });
  rec.recordDeliveryAudit({
    auditId: "da-int-1",
    decisionId,
    traceId,
    status: "target_none",
    reasonCodes: ["not_delivered_by_host_policy"],
    createdAt: now(),
  });
  rec.recordSourceCoverage({
    auditId: "sc-int-1",
    traceId,
    decisionId,
    subjectType: "outreach_draft",
    subjectRef: "subj-1",
    usedSourceRefs: [],
    unresolvedRefs: [],
    coverageRatio: 0,
    unsupportedClaims: [],
    status: "blocked",
    reasonCodes: ["empty_evidence"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision(decisionId);
  assert.ok(ex.relatedEventIds.length >= 3);
  assert.ok(ex.warnings.includes("no_user_visible_contact_claim_prohibited"));
});
