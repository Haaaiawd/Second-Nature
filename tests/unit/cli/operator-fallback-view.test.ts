import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { operatorFallbackArtifacts } from "../../../src/storage/db/schema/operator-fallback-artifacts.js";
import { writeOperatorFallback } from "../../../src/storage/fallback/write-operator-fallback.js";
import type { OperatorFallbackReason } from "../../../src/storage/fallback/operator-fallback-types.js";
import { showOperatorFallback } from "../../../src/cli/ops/show-operator-fallback.js";
import { createCliReadModels } from "../../../src/cli/read-models/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";

const reasons: OperatorFallbackReason[] = ["target_none", "channel_missing", "host_unsupported", "delivery_failed"];

async function seedFallback(state: ReturnType<typeof createStateDatabase>, reason: OperatorFallbackReason, suffix: string) {
  const { fallbackRef } = await writeOperatorFallback(state, {
    reason,
    decisionId: `dec-${suffix}`,
    sourceRefs: [{ id: `sr-${suffix}`, kind: "decision_record", uri: `uri:${suffix}` }],
    candidateMessage: `redacted-${suffix}`,
    nextStep: `next-${suffix}`,
  });
  return fallbackRef;
}

test("T1.2.2 showOperatorFallback — four OperatorFallbackReason kinds; status always not_sent", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });

  for (let i = 0; i < reasons.length; i++) {
    const reason = reasons[i]!;
    const ref = await seedFallback(stateDb, reason, `${i}`);
    const view = await showOperatorFallback(ref, readModels);
    assert.equal(view.status, "not_sent");
    assert.equal(view.reason, reason);
    assert.ok(view.sourceRefs.length);
    assert.equal(view.candidateMessage, `redacted-${i}`);
    assert.equal(view.nextStep, `next-${i}`);
  }

  stateDb.close();
  observabilityDb.close();
});

test("T1.2.2 ref without fallback: prefix normalizes", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });
  const ref = await seedFallback(stateDb, "target_none", "norm");
  const bareUuid = ref.replace(/^fallback:/, "");
  const view = await showOperatorFallback(bareUuid, readModels);
  assert.equal(view.fallbackRef, ref);
  assert.equal(view.status, "not_sent");
  stateDb.close();
  observabilityDb.close();
});

test("T1.2.2 corrupt persisted status is never exposed as sent/delivered", async () => {
  const stateDb = createStateDatabase(":memory:");
  const observabilityDb = createObservabilityDatabase(":memory:");
  const readModels = createCliReadModels({ stateDb, observabilityDb });
  const ref = await seedFallback(stateDb, "delivery_failed", "corrupt");
  await stateDb.db.update(operatorFallbackArtifacts).set({ status: "sent" }).where(eq(operatorFallbackArtifacts.fallbackRef, ref));
  const view = await showOperatorFallback(ref, readModels);
  assert.equal(view.status, "not_sent");
  stateDb.close();
  observabilityDb.close();
});
