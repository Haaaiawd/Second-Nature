function toMinuteOfDay(now, timezone) {
    const date = new Date(now);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
}
function matchWindow(windows, minuteOfDay) {
    const found = windows.find((window) => minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute);
    if (!found) {
        return windows[0];
    }
    return found;
}
export function selectRhythmWindow(now, snapshot, policy) {
    const minuteOfDay = toMinuteOfDay(now, policy.timezone);
    const window = matchWindow(policy.windows, minuteOfDay);
    if (snapshot.mode === "paused_for_interrupt") {
        return {
            windowId: window.id,
            topLevelMode: "paused_for_interrupt",
            interrupted: true,
        };
    }
    if (snapshot.riskSuppressed) {
        return {
            windowId: window.id,
            topLevelMode: "maintenance_only",
            interrupted: false,
        };
    }
    if (window.mode === "quiet") {
        return {
            windowId: window.id,
            topLevelMode: "quiet",
            interrupted: false,
        };
    }
    return {
        windowId: window.id,
        topLevelMode: "active",
        interrupted: false,
    };
}
