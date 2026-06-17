export function serializeSourceRefs(refs) {
    return JSON.stringify(refs);
}
function isSourceRef(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (typeof candidate.uri === "string" &&
        typeof candidate.family === "string" &&
        typeof candidate.id === "string" &&
        typeof candidate.redactionClass === "string" &&
        (candidate.sensitivityClass === undefined ||
            typeof candidate.sensitivityClass === "string"));
}
export function parseSourceRefs(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.every(isSourceRef))
            return parsed;
        return [];
    }
    catch {
        return [];
    }
}
