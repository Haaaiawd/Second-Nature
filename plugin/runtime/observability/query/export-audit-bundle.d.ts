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
export declare function exportAuditBundle(range: AuditBundleExportRange, deps: ExportAuditBundleDeps): Promise<AuditBundle>;
