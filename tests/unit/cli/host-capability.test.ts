import test from "node:test";
import assert from "node:assert/strict";

import { classifyDeliveryCapability } from "../../../src/cli/host-capability/classify-delivery.js";
import { probeHostCapability } from "../../../src/cli/host-capability/probe-host-capability.js";
import type { HostCapabilityAdapter } from "../../../src/cli/host-capability/types.js";

test("classifyDeliveryCapability maps host signals", () => {
  assert.equal(classifyDeliveryCapability({ rawTarget: "none", channel: "x" }), "target_none");
  assert.equal(classifyDeliveryCapability({ rawTarget: "last", channel: "dm" }), "target_available");
  assert.equal(classifyDeliveryCapability({ rawTarget: "last", channel: "" }), "channel_missing");
  assert.equal(classifyDeliveryCapability({ apiAvailable: false }), "host_api_unavailable");
  assert.equal(classifyDeliveryCapability({ hostUnsupported: true }), "host_unsupported");
});

test("probeHostCapability aggregates adapter fields", () => {
  const now = new Date().toISOString();
  const ref = (id: string) => [{ id, family: "audit" as const, uri: `sn://${id}`, redactionClass: "none" as const }];

  const adapter: HostCapabilityAdapter = {
    checkPluginLoad: () => ({ name: "plugin_load", verdict: "pass", observedAt: now, evidenceRefs: ref("p1") }),
    checkHeartbeatBridge: () => ({ name: "heartbeat_bridge", verdict: "pass", observedAt: now, evidenceRefs: ref("h1") }),
    checkHeartbeatToolInvocation: () => ({
      name: "heartbeat_tool_invocation",
      verdict: "unknown",
      observedAt: now,
      evidenceRefs: ref("t1"),
    }),
    checkDeliveryTarget: () => ({ status: "target_none", evidenceRefs: ref("d1"), reason: "host_reports_none" }),
    checkAckDropBehavior: () => ({ name: "ack_drop", verdict: "pass", observedAt: now, evidenceRefs: [] }),
    checkHookSupport: () => [
      { name: "hook:runHeartbeatOnce", verdict: "not_applicable", observedAt: now, evidenceRefs: [] },
    ],
  };

  const report = probeHostCapability({
    adapter,
    docLinks: [
      {
        title: "OpenClaw delivery",
        url: "https://example.invalid/docs",
        checkedAt: now,
        documentedBehavior: "Delivery target available by default",
      },
    ],
    docCheckedAt: now,
    hostVersion: "test-host",
    observedVersion: "test-observed",
  });

  assert.ok(report.reportId.length > 0);
  assert.equal(report.pluginLoad.verdict, "pass");
  assert.equal(report.heartbeatToolInvocation.name, "heartbeat_tool_invocation");
  assert.equal(report.deliveryTarget, "target_none");
  assert.equal(report.hookSupport.length, 1);
  assert.equal(report.docCheckedAt, now);
});
