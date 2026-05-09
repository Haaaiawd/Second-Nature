/**
 * Reproducible host smoke runner (T1.3.1). Uses transcript fixtures — no live OpenClaw in unit/integration path.
 *
 * Core logic: evaluate `heartbeat_tool_invocation` by substring match for heartbeat_check / second_nature_ops heartbeat surface.
 */
import * as crypto from "node:crypto";

import type { DocsVsObservedConflictCase, HeartbeatToolInvocationCase, HostSmokeCase, HostSmokePlan, HostSmokeReport, HostSmokeCaseResult } from "./types.js";

function evalHeartbeatToolInvocation(c: HeartbeatToolInvocationCase): HostSmokeCaseResult {
  const hasHeartbeatCheck = c.toolInvocations.some((t) =>
    /heartbeat_check|second_nature_ops\s*\(\s*\{[^}]*heartbeat_check|command\s*:\s*["']heartbeat_check["']/i.test(t),
  );
  if (hasHeartbeatCheck) {
    return { caseType: c.type, status: "pass", reasons: [] };
  }
  return { caseType: c.type, status: "fail", reasons: ["heartbeat_tool_not_invoked"] };
}

function evalDocsConflict(c: DocsVsObservedConflictCase): HostSmokeCaseResult {
  if (c.observedBehavior.trim() === c.docExpectation.trim()) {
    return { caseType: c.type, status: "pass", reasons: [] };
  }
  return {
    caseType: c.type,
    status: "fail",
    reasons: ["docs_vs_observed_conflict", `expected:${c.docExpectation}`, `observed:${c.observedBehavior}`],
  };
}

function evalCase(c: HostSmokeCase): HostSmokeCaseResult {
  if (c.type === "heartbeat_tool_invocation") {
    return evalHeartbeatToolInvocation(c);
  }
  return evalDocsConflict(c);
}

export async function runHostSmoke(plan: HostSmokePlan): Promise<HostSmokeReport> {
  const results = plan.cases.map((c) => evalCase(c));
  return {
    reportId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    results,
    docLinks: plan.docLinks,
    docCheckedAt: plan.docCheckedAt,
    hostVersion: plan.hostVersion,
  };
}
