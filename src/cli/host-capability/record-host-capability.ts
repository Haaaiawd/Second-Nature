/**
 * Persist HostCapabilityReport into observability SQLite (T1.1.2).
 */
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { hostCapabilityReports } from "../../observability/db/schema/host-capability-reports.js";

import type { HostCapabilityReport } from "./types.js";

export async function recordHostCapability(db: ObservabilityDatabase, report: HostCapabilityReport): Promise<void> {
  await db.db.insert(hostCapabilityReports).values({
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    hostVersion: report.hostVersion ?? null,
    observedVersion: report.observedVersion ?? null,
    docCheckedAt: report.docCheckedAt,
    docLinksJson: JSON.stringify(report.docLinks),
    deliveryTarget: report.deliveryTarget,
    conflictRecordsJson: JSON.stringify(report.conflictRecords),
    fullReportJson: JSON.stringify(report),
  });
}
