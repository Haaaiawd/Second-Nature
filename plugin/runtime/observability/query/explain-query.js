const NO_USER_VISIBLE = "no_user_visible_contact_claim_prohibited";
function isNoUserVisibleDelivery(status) {
    if (!status)
        return false;
    return (status === "target_none" ||
        status === "not_sent_fallback" ||
        status === "channel_missing" ||
        status === "host_unsupported" ||
        status === "failed" ||
        status === "ack_dropped");
}
function payloadDecisionId(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const p = payload;
    const v = p.decisionId;
    return typeof v === "string" ? v : undefined;
}
function payloadFallbackRef(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const p = payload;
    const v = p.fallbackRef;
    return typeof v === "string" ? v : undefined;
}
function payloadAuditId(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const p = payload;
    const a = p.auditId;
    if (typeof a === "string")
        return a;
    return undefined;
}
function deliveryStatusFrom(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    const p = payload;
    const s = p.status;
    return typeof s === "string" ? s : undefined;
}
function eventMatchesQuery(envelope, query) {
    const payload = envelope.payload;
    switch (query.kind) {
        case "decision":
            return payloadDecisionId(payload) === query.decisionId;
        case "fallback":
            return payloadFallbackRef(payload) === query.fallbackRef;
        case "report":
            return envelope.eventId === query.reportId || payloadAuditId(payload) === query.reportId;
        case "delivery":
            return (envelope.family === "delivery" &&
                (envelope.eventId === query.auditId || payloadAuditId(payload) === query.auditId));
        case "source_ref": {
            const needle = query.sourceRefId;
            try {
                return JSON.stringify(payload).includes(needle);
            }
            catch {
                return false;
            }
        }
    }
}
function summarizeEnvelope(e) {
    const fam = e.family;
    if (fam === "delivery") {
        const st = deliveryStatusFrom(e.payload);
        return `delivery_audit:${st ?? "unknown"}`;
    }
    if (fam === "heartbeat.decision") {
        const outcome = e.payload?.outcome;
        return `decision:${typeof outcome === "string" ? outcome : "unknown"}`;
    }
    return `${fam}`;
}
/**
 * Query explain read model from an in-memory append-only audit slice (tests / local tooling).
 */
export function queryExplain(query, store) {
    const matched = store.list().filter((e) => eventMatchesQuery(e, query));
    const relatedEventIds = matched.map((e) => e.eventId);
    const warnings = [];
    let deliveryStatus;
    for (const e of matched) {
        if (e.family === "delivery") {
            const st = deliveryStatusFrom(e.payload);
            if (st)
                deliveryStatus = st;
            if (isNoUserVisibleDelivery(st)) {
                warnings.push(NO_USER_VISIBLE);
            }
        }
    }
    const uniqueWarnings = [...new Set(warnings)];
    const summary = matched.length === 0
        ? "no_matching_audit_events"
        : `matched_events=${matched.length};subject=${query.kind}`;
    const events = matched.map((e) => ({
        eventId: e.eventId,
        family: e.family,
        plane: e.plane,
        createdAt: e.createdAt,
        summary: summarizeEnvelope(e),
    }));
    return {
        query,
        summary,
        warnings: uniqueWarnings,
        deliveryStatus,
        relatedEventIds,
        events,
    };
}
