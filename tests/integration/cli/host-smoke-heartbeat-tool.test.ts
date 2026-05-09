import test from "node:test";
import assert from "node:assert/strict";

import { runHostSmoke } from "../../../src/cli/host-smoke/run-host-smoke.js";

test("T1.3.1 heartbeat_tool_invocation — pass when transcript invokes heartbeat_check", async () => {
  const report = await runHostSmoke({
    cases: [
      {
        type: "heartbeat_tool_invocation",
        toolInvocations: ['second_nature_ops({ command: "heartbeat_check" })'],
      },
    ],
  });
  assert.equal(report.results[0]?.status, "pass");
});

test("T1.3.1 heartbeat_tool_not_invoked when tool missing", async () => {
  const report = await runHostSmoke({
    cases: [{ type: "heartbeat_tool_invocation", toolInvocations: ["some_other_tool()"] }],
  });
  assert.equal(report.results[0]?.status, "fail");
  assert.ok(report.results[0]?.reasons.includes("heartbeat_tool_not_invoked"));
});

test("T1.3.1 docs_vs_observed_conflict fixture", async () => {
  const report = await runHostSmoke({
    cases: [
      {
        type: "docs_vs_observed_conflict",
        docExpectation: "must_invoke_heartbeat_check",
        observedBehavior: "skipped_tool",
      },
    ],
  });
  assert.equal(report.results[0]?.status, "fail");
  assert.ok(report.results[0]?.reasons.some((r) => r.includes("docs_vs_observed")));
});
