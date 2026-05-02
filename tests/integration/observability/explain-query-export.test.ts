import test from "node:test";
import assert from "node:assert/strict";

import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { createAppendOnlyAuditStoreRangeLoader } from "../../../src/observability/audit/verify-audit-hash-chain.js";
import { queryExplain } from "../../../src/observability/query/explain-query.js";
import { exportAuditBundle } from "../../../src/observability/query/export-audit-bundle.js";
import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";

const now = () => "2026-05-03T10:00:00.000Z";

test("T5.3.1 queryExplain fallbackRef → warning no user-visible contact", () => {
  const store = new AppendOnlyAuditStore();
  const rec = createLivedExperienceAuditRecorder(store);
  const decisionId = "dec-s4";
  const traceId = "tr-s4";
  rec.recordDeliveryAudit({
    auditId: "da-fb",
    decisionId,
    traceId,
    status: "not_sent_fallback",
    fallbackRef: "fallback:abc-123",
    reasonCodes: ["operator_fallback"],
    createdAt: now(),
  });
  const op = queryExplain({ kind: "fallback", fallbackRef: "fallback:abc-123" }, store);
  assert.ok(op.warnings.includes("no_user_visible_contact_claim_prohibited"));
  assert.equal(op.deliveryStatus, "not_sent_fallback");
});

test("T5.3.1 queryExplain decisionId + delivery auditId + source_ref", () => {
  const store = new AppendOnlyAuditStore();
  const rec = createLivedExperienceAuditRecorder(store);
  const decisionId = "dec-multi";
  const traceId = "tr-multi";
  const srcId = "src-ref-99";
  rec.recordDecisionTrace({
    decisionId,
    traceId,
    runtimeScope: "rhythm",
    outcome: "heartbeat_ok",
    reasonCodes: [],
    sourceRefs: [{ id: srcId, kind: "platform_item", uri: "https://example.test/r" }],
    createdAt: now(),
  });
  rec.recordDeliveryAudit({
    auditId: "da-99",
    decisionId,
    traceId,
    status: "failed",
    reasonCodes: ["x"],
    createdAt: now(),
  });
  const byDecision = queryExplain({ kind: "decision", decisionId }, store);
  assert.equal(byDecision.relatedEventIds.length, 2);
  const byDelivery = queryExplain({ kind: "delivery", auditId: "da-99" }, store);
  assert.equal(byDelivery.relatedEventIds.length, 1);
  const bySource = queryExplain({ kind: "source_ref", sourceRefId: srcId }, store);
  assert.ok(bySource.relatedEventIds.length >= 1);
});

test("T5.3.1 queryExplain reportId matches envelope eventId", () => {
  const store = new AppendOnlyAuditStore();
  const rec = createLivedExperienceAuditRecorder(store);
  rec.recordSourceCoverage({
    auditId: "sc-1",
    traceId: "trep",
    subjectType: "quiet_artifact",
    subjectRef: "quiet/day",
    usedSourceRefs: [],
    unresolvedRefs: [],
    coverageRatio: 1,
    unsupportedClaims: [],
    status: "pass",
    reasonCodes: [],
    createdAt: now(),
  });
  const op = queryExplain({ kind: "report", reportId: "sc-1" }, store);
  assert.equal(op.relatedEventIds.length, 1);
});

test("T5.3.1 exportAuditBundle returns redaction summary for range", async () => {
  const store = new AppendOnlyAuditStore();
  const rec = createLivedExperienceAuditRecorder(store);
  rec.recordDecisionTrace({
    decisionId: "d1",
    traceId: "t1",
    runtimeScope: "rhythm",
    outcome: "heartbeat_ok",
    reasonCodes: [],
    sourceRefs: [],
    createdAt: "2026-05-03T11:00:00.000Z",
  });
  const bundle = await exportAuditBundle(
    { from: "2026-05-03T00:00:00.000Z", to: "2026-05-03T23:59:59.000Z" },
    createAppendOnlyAuditStoreRangeLoader(store),
  );
  assert.equal(bundle.events.length, 1);
  assert.equal(bundle.redactionSummary.eventCount, 1);
  assert.ok(bundle.redactionSummary.manifestIds.length >= 1);
});
