import type { AppendOnlyAuditStore } from "./append-only-audit-store.js";
import { type AuditEnvelope, type AuditEventFamily } from "./audit-envelope.js";
export interface AuditExportRange {
    from: string;
    to: string;
    families?: AuditEventFamily[];
}
export type AuditHashChainVerificationStatus = "pass" | "broken" | "incomplete";
export interface AuditHashChainVerificationReport {
    reportId: string;
    generatedAt: string;
    range: AuditExportRange;
    checkedEventCount: number;
    status: AuditHashChainVerificationStatus;
    brokenAtEventIds: string[];
    reasons: string[];
}
export interface VerifyAuditHashChainDeps {
    loadRange(from: string, to: string, families?: AuditEventFamily[]): Promise<readonly AuditEnvelope<unknown>[]>;
}
export declare function verifyAuditHashChain(range: AuditExportRange, deps: VerifyAuditHashChainDeps): Promise<AuditHashChainVerificationReport>;
/** In-memory adapter: filter `AppendOnlyAuditStore.list()` by createdAt + optional families. */
export declare function createAppendOnlyAuditStoreRangeLoader(store: AppendOnlyAuditStore): VerifyAuditHashChainDeps;
