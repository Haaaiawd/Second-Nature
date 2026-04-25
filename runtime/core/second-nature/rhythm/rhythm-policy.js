export function validateRhythmPolicy(policy) {
    if (policy.windows.length === 0) {
        throw new Error("rhythm_policy_windows_required");
    }
    const sorted = [...policy.windows].sort((a, b) => a.startMinute - b.startMinute);
    for (const window of sorted) {
        if (window.startMinute < 0 || window.startMinute > 1439) {
            throw new Error(`invalid_window_start:${window.id}`);
        }
        if (window.endMinute < 1 || window.endMinute > 1440) {
            throw new Error(`invalid_window_end:${window.id}`);
        }
        if (window.startMinute >= window.endMinute) {
            throw new Error(`invalid_window_range:${window.id}`);
        }
    }
    for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (current.startMinute < previous.endMinute) {
            throw new Error(`overlapping_window_range:${previous.id}:${current.id}`);
        }
    }
}
