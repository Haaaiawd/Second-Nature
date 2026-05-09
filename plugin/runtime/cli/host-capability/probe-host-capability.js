/**
 * OpenClaw host capability probe — aggregates adapter checks into HostCapabilityReport.
 */
import * as crypto from "node:crypto";
function mergeEvidenceRefs(...groups) {
    const seen = new Set();
    const out = [];
    for (const group of groups) {
        for (const ref of group) {
            const key = `${ref.kind}:${ref.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push(ref);
            }
        }
    }
    return out;
}
export function probeHostCapability(options) {
    const { adapter, docLinks, docCheckedAt, hostVersion, observedVersion } = options;
    const generatedAt = new Date().toISOString();
    const pluginLoad = adapter.checkPluginLoad();
    const heartbeatBridge = adapter.checkHeartbeatBridge();
    const heartbeatToolInvocation = adapter.checkHeartbeatToolInvocation();
    const delivery = adapter.checkDeliveryTarget();
    const deliveryTarget = delivery.status;
    const ackDropBehavior = adapter.checkAckDropBehavior();
    const hookSupport = adapter.checkHookSupport();
    const conflictRecords = [];
    if (delivery.reason === "docs_vs_observed_mismatch" && docLinks.length > 0) {
        const doc = docLinks[0];
        conflictRecords.push({
            capability: "delivery_target",
            documentedBehavior: doc.documentedBehavior,
            observedBehavior: deliveryTarget,
            hostVersion,
            docUrl: doc.url,
        });
    }
    const evidenceRefs = mergeEvidenceRefs(pluginLoad.evidenceRefs, heartbeatBridge.evidenceRefs, heartbeatToolInvocation.evidenceRefs, delivery.evidenceRefs, ackDropBehavior.evidenceRefs, ...hookSupport.map((h) => h.evidenceRefs));
    return {
        reportId: crypto.randomUUID(),
        generatedAt,
        hostVersion,
        observedVersion,
        docLinks,
        docCheckedAt,
        pluginLoad,
        heartbeatBridge,
        heartbeatToolInvocation,
        deliveryTarget,
        ackDropBehavior,
        hookSupport,
        evidenceRefs,
        conflictRecords,
        recommendedNextStep: conflictRecords.length > 0 ? "reconcile_docs_vs_observed" : undefined,
    };
}
