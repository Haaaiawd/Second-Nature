/**
 * Redacted audit export bundle for operator / retention tooling (T5.3.1).
 *
 * Core logic: load range, attach export metadata; payloads are already redacted at envelope build time.
 *
 * Dependencies: same range loader pattern as verifyAuditHashChain.
 *
 * Test coverage: tests/integration/observability/explain-query-export.test.ts
 */
import * as crypto from "node:crypto";

import type { AuditEnvelope } from "../audit/audit-envelope.js";
import type { AuditEventFamily } from "../audit/audit-envelope.js";
import type { AuditExportRange } from "../audit/verify-audit-hash-chain.js";

export interface AuditBundleExportRange extends AuditExportRange {
  /** Reserved for otel_projection / future formats */
  format?: "json_v1";
}

export interface AuditRedactionSummary {
  eventCount: number;
  manifestIds: string[];
}

export interface AuditBundle {
  bundleId: string;
  generatedAt: string;
  range: AuditBundleExportRange;
  events: readonly AuditEnvelope<unknown>[];
  redactionSummary: AuditRedactionSummary;
}

export interface ExportAuditBundleDeps {
  loadRange(from: string, to: string, families?: AuditEventFamily[]): Promise<readonly AuditEnvelope<unknown>[]>;
}

function summarize(events: readonly AuditEnvelope<unknown>[]): AuditRedactionSummary {
  const ids = new Set<string>();
  for (const e of events) {
    ids.add(e.redaction.manifestId);
  }
  return { eventCount: events.length, manifestIds: [...ids] };
}

export async function exportAuditBundle(range: AuditBundleExportRange, deps: ExportAuditBundleDeps): Promise<AuditBundle> {
  const events = [...(await deps.loadRange(range.from, range.to, range.families))].sort((a, b) => a.sequence - b.sequence);
  return {
    bundleId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    range,
    events,
    redactionSummary: summarize(events),
  };
}
