import test from "node:test";
import assert from "node:assert/strict";

import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";

const now = () => new Date().toISOString();

test("T5.2.1 target_none delivery audit -> explain warns no user-visible contact", () => {
  const rec = createLivedExperienceAuditRecorder();
  rec.recordDecisionTrace({
    decisionId: "dec-1",
    traceId: "tr-1",
    runtimeScope: "rhythm",
    outcome: "heartbeat_ok",
    reasonCodes: ["observed_target_none"],
    sourceRefs: [],
    createdAt: now(),
  });
  rec.recordDeliveryAudit({
    auditId: "da-1",
    decisionId: "dec-1",
    traceId: "tr-1",
    status: "target_none",
    reasonCodes: ["not_delivered_by_host_policy"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision("dec-1");
  assert.ok(ex.warnings.includes("no_user_visible_contact_claim_prohibited"));
  assert.equal(ex.deliveryStatus, "target_none");
});

test("T5.2.1 sent without messageId rejected at audit layer", () => {
  const rec = createLivedExperienceAuditRecorder();
  assert.throws(
    () =>
      rec.recordDeliveryAudit({
        auditId: "da-2",
        decisionId: "dec-2",
        traceId: "tr-2",
        status: "sent",
        reasonCodes: [],
        createdAt: now(),
      }),
    /delivery_audit_sent_requires/,
  );
});

test("T5.2.1 sent with messageId ok", () => {
  const rec = createLivedExperienceAuditRecorder();
  rec.recordDeliveryAudit({
    auditId: "da-3",
    decisionId: "dec-3",
    traceId: "tr-3",
    status: "sent",
    messageId: "mid",
    reasonCodes: ["message_sent"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision("dec-3");
  assert.equal(ex.deliveryStatus, "sent");
  assert.equal(ex.warnings.length, 0);
});

test("T5.2.1 not_sent_fallback sets warning", () => {
  const rec = createLivedExperienceAuditRecorder();
  rec.recordDeliveryAudit({
    auditId: "da-4",
    decisionId: "dec-4",
    traceId: "tr-4",
    status: "not_sent_fallback",
    fallbackRef: "fb",
    reasonCodes: ["operator_fallback_not_sent"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision("dec-4");
  assert.ok(ex.warnings.includes("no_user_visible_contact_claim_prohibited"));
});

test("T5.2.1 ack_dropped sets no_user_visible_contact warning", () => {
  const rec = createLivedExperienceAuditRecorder();
  rec.recordDecisionTrace({
    decisionId: "dec-ad",
    traceId: "tr-ad",
    runtimeScope: "rhythm",
    outcome: "heartbeat_ok",
    reasonCodes: [],
    sourceRefs: [],
    createdAt: now(),
  });
  rec.recordDeliveryAudit({
    auditId: "da-ad",
    decisionId: "dec-ad",
    traceId: "tr-ad",
    status: "ack_dropped",
    reasonCodes: ["host_ack_dropped"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision("dec-ad");
  assert.ok(ex.warnings.includes("no_user_visible_contact_claim_prohibited"));
  assert.equal(ex.deliveryStatus, "ack_dropped");
});

test("T5.2.1 sent with hostProofRef only is accepted", () => {
  const rec = createLivedExperienceAuditRecorder();
  rec.recordDeliveryAudit({
    auditId: "da-hp",
    decisionId: "dec-hp",
    traceId: "tr-hp",
    status: "sent",
    hostProofRef: { id: "hp1", kind: "connector_result", uri: "https://example.com/proof" },
    reasonCodes: ["message_sent"],
    createdAt: now(),
  });
  const ex = rec.explainLinkageForDecision("dec-hp");
  assert.equal(ex.deliveryStatus, "sent");
  assert.equal(ex.warnings.length, 0);
});
