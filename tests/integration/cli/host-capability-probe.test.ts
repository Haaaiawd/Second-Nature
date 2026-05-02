import test from "node:test";
import assert from "node:assert/strict";

import { probeHostCapability, recordHostCapability } from "../../../src/cli/index.js";
import { createObservabilityDatabase } from "../../../src/observability/db/index.js";
import { hostCapabilityReports } from "../../../src/observability/db/schema/host-capability-reports.js";
import type { HostCapabilityAdapter } from "../../../src/cli/host-capability/types.js";

test("T1.1.2 recordHostCapability persists probe report", async () => {
  const obs = createObservabilityDatabase(":memory:");
  const now = new Date().toISOString();
  const ref = (id: string) => [{ id, kind: "host_report" as const, uri: `sn://${id}` }];

  const adapter: HostCapabilityAdapter = {
    checkPluginLoad: () => ({ name: "plugin_load", verdict: "pass", observedAt: now, evidenceRefs: ref("p1") }),
    checkHeartbeatBridge: () => ({ name: "heartbeat_bridge", verdict: "pass", observedAt: now, evidenceRefs: ref("h1") }),
    checkHeartbeatToolInvocation: () => ({
      name: "heartbeat_tool_invocation",
      verdict: "fail",
      observedAt: now,
      evidenceRefs: ref("t1"),
    }),
    checkDeliveryTarget: () => ({ status: "target_available", evidenceRefs: ref("d1") }),
    checkAckDropBehavior: () => ({ name: "ack_drop", verdict: "unknown", observedAt: now, evidenceRefs: [] }),
    checkHookSupport: () => [],
  };

  const report = probeHostCapability({
    adapter,
    docLinks: [],
    docCheckedAt: now,
    hostVersion: "1.0",
  });

  await recordHostCapability(obs, report);

  const rows = await obs.db.select().from(hostCapabilityReports);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.reportId, report.reportId);
  assert.equal(rows[0]!.deliveryTarget, "target_available");

  const full = JSON.parse(rows[0]!.fullReportJson) as { heartbeatToolInvocation: { verdict: string } };
  assert.equal(full.heartbeatToolInvocation.verdict, "fail");

  obs.close();
});
