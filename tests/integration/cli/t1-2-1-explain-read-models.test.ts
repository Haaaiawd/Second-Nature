import test from "node:test";
import assert from "node:assert/strict";

import { AppendOnlyAuditStore } from "../../../src/observability/audit/append-only-audit-store.js";
import { createLivedExperienceAuditRecorder } from "../../../src/observability/services/lived-experience-audit.js";
import { createCliReadModels } from "../../../src/cli/read-models/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import { explainSurfaceSubject } from "../../../src/cli/explain/explain-surface-subject.js";

const ts = "2026-05-03T12:00:00.000Z";

test("T1.2.1 explainSurfaceSubject + read models: decisionId + delivery not_sent_fallback", async () => {
  const store = new AppendOnlyAuditStore();
  const rec = createLivedExperienceAuditRecorder(store);
  const decisionId = "dec-cli-1";
  rec.recordDecisionTrace({
    decisionId,
    traceId: "tr-cli",
    runtimeScope: "rhythm",
    outcome: "delivery_unavailable",
    reasonCodes: ["delivery_failed"],
    sourceRefs: [],
    createdAt: ts,
  });
  rec.recordDeliveryAudit({
    auditId: "da-cli",
    decisionId,
    traceId: "tr-cli",
    status: "not_sent_fallback",
    fallbackRef: "fallback:fb-cli-1",
    reasonCodes: [],
    createdAt: ts,
  });

  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({
    stateDb,
    observabilityDb,
    livedExperienceAuditStore: store,
  });
  const model = await explainSurfaceSubject(
    `decision:${decisionId}`,
    readModels,
  );
  assert.ok(
    model.warnings?.includes("no_user_visible_contact_claim_prohibited"),
  );
  assert.ok(model.relatedAuditEventIds?.length);
  stateDb.close();
  observabilityDb.close();
});

// T1.2.5 (CH-14-05): createCliReadModels now default-injects an empty AppendOnlyAuditStore,
// so callers that don't explicitly provide a store still get a functional explain path.
// The conclusion for an unknown subject with the default (empty) store is "no_matching_audit_events"
// rather than "lived_experience_audit_store_unavailable" — this is the corrected behavior.
test("T1.2.1 unknown audit-only subject without store → no_matching_audit_events (default store injected)", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });
  const model = await explainSurfaceSubject(
    "fallback:missing-ref-test",
    readModels,
  );
  // T1.2.5: default store is now always injected; empty store → no_matching_audit_events
  assert.equal(model.conclusion, "no_matching_audit_events");
  stateDb.close();
  observabilityDb.close();
});
