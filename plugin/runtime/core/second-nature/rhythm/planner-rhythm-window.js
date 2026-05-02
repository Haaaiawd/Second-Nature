import { selectRhythmWindow } from "./select-window.js";
const ALL_INTENT_KINDS = [
    "work",
    "exploration",
    "social",
    "quiet",
    "reflection",
    "outreach",
    "maintenance",
];
function allowedForPaused() {
    return ["maintenance"];
}
function allowedForMaintenanceOnly() {
    return ["work", "maintenance"];
}
function allowedForActiveWindow(windowId) {
    if (windowId.includes("work")) {
        return ["work", "exploration", "maintenance", "reflection", "outreach", "social", "quiet"];
    }
    if (windowId.includes("social")) {
        return ["social", "exploration", "work", "maintenance", "reflection", "outreach", "quiet"];
    }
    if (windowId.includes("reflection")) {
        return ["reflection", "work", "maintenance", "exploration", "social", "outreach", "quiet"];
    }
    return ALL_INTENT_KINDS;
}
function mergeQuietBias(decision, continuity, windowIsQuiet) {
    return windowIsQuiet || decision.topLevelMode === "quiet" || continuity.mode === "quiet";
}
/**
 * Derive allowed intent kinds and quiet bias for candidate planning.
 */
export function buildPlannerRhythmWindow(now, continuity, policy) {
    const decision = selectRhythmWindow(now, continuity, policy);
    const window = policy.windows.find((w) => w.id === decision.windowId) ?? policy.windows[0];
    const windowIsQuiet = window.mode === "quiet";
    const quietBias = mergeQuietBias(decision, continuity, windowIsQuiet);
    let allowed;
    if (decision.topLevelMode === "paused_for_interrupt") {
        allowed = allowedForPaused();
    }
    else if (decision.topLevelMode === "maintenance_only") {
        allowed = allowedForMaintenanceOnly();
    }
    else {
        /** Calendar quiet sets `quietBias` only; candidate kinds stay window-biased (guards enforce quiet suppression). */
        allowed = allowedForActiveWindow(window.id);
    }
    return { windowId: decision.windowId, allowedIntentKinds: allowed, quietBias };
}
