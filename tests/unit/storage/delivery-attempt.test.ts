import test from "node:test";
import assert from "node:assert/strict";

import { createStateDatabase } from "../../../src/storage/db/index.js";
import { writeDeliveryAttempt } from "../../../src/storage/delivery/write-delivery-attempt.js";
import { listDeliveryAttemptsByDecisionId } from "../../../src/storage/delivery/query-delivery-attempts.js";

test("T4.3.1 sent with messageId persists", async () => {
  const state = createStateDatabase(":memory:");
  await writeDeliveryAttempt(state, {
    attemptId: "a1",
    decisionId: "d1",
    target: "explicit",
    channel: "dm",
    status: "sent",
    messageId: "m-1",
  });
  const rows = await listDeliveryAttemptsByDecisionId(state, "d1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].messageId, "m-1");
  state.close();
});

test("T4.3.1 sent with hostProofRef persists", async () => {
  const state = createStateDatabase(":memory:");
  await writeDeliveryAttempt(state, {
    attemptId: "a2",
    decisionId: "d2",
    status: "sent",
    hostProofRef: { id: "hp1", kind: "host_report", uri: "urn:host:proof:1" },
  });
  const rows = await listDeliveryAttemptsByDecisionId(state, "d2");
  assert.equal(rows[0].hostProofRef?.id, "hp1");
  state.close();
});

test("T4.3.1 sent without proof rejected", async () => {
  const state = createStateDatabase(":memory:");
  await assert.rejects(
    () =>
      writeDeliveryAttempt(state, {
        attemptId: "a3",
        decisionId: "d3",
        status: "sent",
      }),
    /delivery_attempt_sent_requires/,
  );
  state.close();
});

test("T4.3.1 failed requires errorClass or fallbackRef", async () => {
  const state = createStateDatabase(":memory:");
  await assert.rejects(
    () =>
      writeDeliveryAttempt(state, {
        attemptId: "a4",
        decisionId: "d4",
        status: "failed",
      }),
    /delivery_attempt_failed_requires/,
  );
  await writeDeliveryAttempt(state, {
    attemptId: "a5",
    decisionId: "d4",
    status: "failed",
    errorClass: "network",
  });
  const rows = await listDeliveryAttemptsByDecisionId(state, "d4");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].errorClass, "network");
  state.close();
});

test("T4.3.1 dropped_by_host_policy with fallbackRef", async () => {
  const state = createStateDatabase(":memory:");
  await writeDeliveryAttempt(state, {
    attemptId: "a6",
    decisionId: "d6",
    status: "dropped_by_host_policy",
    fallbackRef: "fb-1",
  });
  const rows = await listDeliveryAttemptsByDecisionId(state, "d6");
  assert.equal(rows[0].fallbackRef, "fb-1");
  state.close();
});
