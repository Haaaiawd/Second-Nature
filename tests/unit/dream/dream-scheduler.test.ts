import test from "node:test";
import assert from "node:assert/strict";

import { shouldTrigger, type TriggerPolicy } from "../../../src/dream/index.js";

test("T-DQS.C.4 quiet_completion in window triggers", () => {
  const policy: TriggerPolicy = {
    type: "quiet_completion",
    quietCompletedAt: "2026-05-23T23:00:00Z",
    windowStartHour: 22,
    windowEndHour: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "quiet_completion_in_window");
});

test("T-DQS.C.4 quiet_completion out of window skips", () => {
  const policy: TriggerPolicy = {
    type: "quiet_completion",
    quietCompletedAt: "2026-05-23T12:00:00Z",
    windowStartHour: 22,
    windowEndHour: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, false);
  assert.equal(result.reason, "skip:out_of_window");
});

test("T-DQS.C.4 quiet_completion window handles wrap-around", () => {
  const policy: TriggerPolicy = {
    type: "quiet_completion",
    quietCompletedAt: "2026-05-23T02:00:00Z",
    windowStartHour: 22,
    windowEndHour: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
  assert.equal(result.reason, "quiet_completion_in_window");
});

test("T-DQS.C.4 quiet_completion at exact windowStartHour triggers", () => {
  const policy: TriggerPolicy = {
    type: "quiet_completion",
    quietCompletedAt: "2026-05-23T22:00:00Z",
    windowStartHour: 22,
    windowEndHour: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, true);
});

test("T-DQS.C.4 quiet_completion at exact windowEndHour does not trigger", () => {
  const policy: TriggerPolicy = {
    type: "quiet_completion",
    quietCompletedAt: "2026-05-23T06:00:00Z",
    windowStartHour: 22,
    windowEndHour: 6,
  };

  const result = shouldTrigger(policy);
  assert.equal(result.shouldRun, false);
  assert.equal(result.reason, "skip:out_of_window");
});
