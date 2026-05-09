export function classifyDeliveryCapability(input) {
    if (input.hostUnsupported) {
        return "host_unsupported";
    }
    if (input.apiAvailable === false) {
        return "host_api_unavailable";
    }
    const target = (input.rawTarget ?? "").trim().toLowerCase();
    if (target === "none" || target === "") {
        return "target_none";
    }
    const ch = (input.channel ?? "").trim();
    if (!ch) {
        return "channel_missing";
    }
    if (target === "unknown" || target === "unspecified") {
        return "unknown";
    }
    return "target_available";
}
