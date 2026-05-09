/**
 * Resolves OpenClaw-visible delivery target from host capability snapshot (T2.3.1 / ADR-007).
 *
 * Core logic: explicit/last targets require channel materialization; `none` is a first-class verdict.
 * Test coverage: tests/unit/core/outreach-judgment.test.ts
 */
export function resolveDeliveryTarget(snapshot) {
    if (snapshot.hostUnsupported) {
        return {
            verdict: "host_unsupported",
            target: snapshot.target && String(snapshot.target).trim() !== "" && snapshot.target !== "none"
                ? snapshot.target
                : "none",
            reason: "host_delivery_surface_unsupported",
        };
    }
    const raw = snapshot.target;
    if (raw === undefined || raw === null || String(raw).trim() === "" || raw === "none") {
        return {
            verdict: "target_none",
            target: "none",
            reason: "heartbeat_run_without_user_visible_delivery",
        };
    }
    if (raw === "explicit") {
        const ch = (snapshot.channel ?? "").trim();
        const rec = (snapshot.recipient ?? "").trim();
        if (!ch || !rec) {
            return {
                verdict: "channel_missing",
                target: "explicit",
                reason: "explicit_delivery_requires_channel_and_recipient",
            };
        }
        return {
            verdict: "target_available",
            target: "explicit",
            channel: ch,
            recipient: rec,
            reason: "delivery_target_available",
        };
    }
    if (raw === "last") {
        const lastCh = (snapshot.lastKnownVisibleChannel ?? "").trim();
        if (!lastCh) {
            return {
                verdict: "channel_missing",
                target: "last",
                reason: "last_target_has_no_known_visible_channel",
            };
        }
        return {
            verdict: "target_available",
            target: "last",
            channel: lastCh,
            recipient: snapshot.recipient?.trim() || undefined,
            reason: "delivery_target_available",
        };
    }
    return {
        verdict: "target_available",
        target: raw,
        channel: snapshot.channel?.trim() || snapshot.lastKnownVisibleChannel?.trim() || undefined,
        recipient: snapshot.recipient?.trim() || undefined,
        reason: "delivery_target_available",
    };
}
export function isDeliveryUnavailableReason(reason) {
    return reason === "target_none" || reason === "channel_missing" || reason === "host_unsupported";
}
