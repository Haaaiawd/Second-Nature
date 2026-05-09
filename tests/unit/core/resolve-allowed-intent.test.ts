import test from "node:test";
import assert from "node:assert/strict";

import { resolveAllowedIntentResult } from "../../../src/core/second-nature/heartbeat/heartbeat-loop.js";
import type { HeartbeatSignal } from "../../../src/core/second-nature/heartbeat/signal.js";
import type { SnapshotInputs } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildContinuitySnapshot } from "../../../src/core/second-nature/heartbeat/snapshot-builder.js";
import { buildHeartbeatRuntimeSnapshot } from "../../../src/core/second-nature/heartbeat/runtime-snapshot.js";
import type { CandidateIntent } from "../../../src/core/second-nature/types.js";
import { createDraftOutreachMessagePort } from "../../../src/guidance/draft-outreach-message.js";
import { createStateDatabase } from "../../../src/storage/db/index.js";

const signal: HeartbeatSignal = {
  trigger: "heartbeat_bridge",
  scopeHint: "rhythm",
  payload: { timestamp: "2026-05-02T12:00:00.000Z" },
};

test("CR-M1 resolveAllowedIntentResult runs outreach dispatch chain", async () => {
  const state = createStateDatabase(":memory:");
  const candidate: CandidateIntent = {
    id: "c-out",
    kind: "outreach",
    priority: 40,
    source: "tick",
    summary: "platform direction check-in",
    effectClass: "user_outreach",
    sourceRefs: [{ id: "s1", kind: "platform_item", uri: "https://example/s1" }],
    idempotencyKey: "outreach:test",
  };
  const inputs: SnapshotInputs = {
    mode: "active",
    currentWindowId: "win_work_morning",
    pendingObligations: [],
    recentOutreachHashes: [],
    deniedIntents: [],
    lifeEvidenceRefs: [{ id: "s1", kind: "platform_item", uri: "https://example/s1" }],
    deliveryCapability: { target: "explicit", channel: "dm", recipient: "u1" },
    userInterestSnapshot: {
      snapshotId: "uis-1",
      generatedAt: "2026-05-02T12:00:00Z",
      signals: [
        {
          id: "sig-1",
          topic: "platform",
          confidence: 0.8,
          affinity: "positive",
          reason: "r",
          sourceRefs: [],
          updatedAt: "2026-05-02T12:00:00Z",
        },
      ],
      sourceRefs: [],
      confidence: 0.8,
      staleness: "fresh",
    },
  };
  const continuity = buildContinuitySnapshot(inputs);
  const runtime = buildHeartbeatRuntimeSnapshot("2026-05-02T12:00:00.000Z", inputs, continuity);

  const r = await resolveAllowedIntentResult(
    candidate,
    runtime,
    inputs,
    signal,
    {
      outreachDispatch: {
        state,
        guidance: createDraftOutreachMessagePort(),
        delivery: {
          sendDeliveryRequest: async () => ({
            id: "att-x",
            status: "failed",
            errorClass: "transport_failure",
          }),
        },
      },
    },
  );

  assert.equal(r.status, "delivery_unavailable");
  state.close();
});
