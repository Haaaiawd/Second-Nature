import { hostCapabilityReports } from "../../observability/db/schema/host-capability-reports.js";
export async function recordHostCapability(db, report) {
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
