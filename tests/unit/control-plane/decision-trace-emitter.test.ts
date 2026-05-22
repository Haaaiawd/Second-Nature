import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createDecisionTraceEmitter,
  createNoOpTraceEmitter,
  type DecisionTracePayload,
} from "../../../src/core/second-nature/heartbeat/decision-trace-emitter.js";

describe("createDecisionTraceEmitter", () => {
  it("emits trace payload through the port", async () => {
    let captured: DecisionTracePayload | undefined;
    const emitter = createDecisionTraceEmitter(async (payload) => {
      captured = payload;
    });

    const trace: DecisionTracePayload = {
      traceId: "trace:1",
      decisionId: "dec:1",
      scope: "rhythm",
      status: "intent_selected",
      reasons: ["guard_allow"],
      emittedAt: new Date().toISOString(),
    };

    await emitter.emit(trace);
    assert.ok(captured);
    assert.strictEqual(captured!.traceId, "trace:1");
    assert.strictEqual(captured!.decisionId, "dec:1");
  });

  it("rethrows port errors (emitter does not swallow)", async () => {
    const emitter = createDecisionTraceEmitter(async () => {
      throw new Error("port failure");
    });

    await assert.rejects(
      emitter.emit({
        traceId: "trace:2",
        decisionId: "dec:2",
        scope: "rhythm",
        status: "deferred",
        reasons: [],
        emittedAt: new Date().toISOString(),
      }),
      /port failure/,
    );
  });
});

describe("createNoOpTraceEmitter", () => {
  it("swallows any trace without error", async () => {
    const emitter = createNoOpTraceEmitter();
    await assert.doesNotReject(async () => {
      await emitter.emit({
        traceId: "trace:3",
        decisionId: "dec:3",
        scope: "rhythm",
        status: "heartbeat_ok",
        reasons: [],
        emittedAt: new Date().toISOString(),
      });
    });
  });
});
