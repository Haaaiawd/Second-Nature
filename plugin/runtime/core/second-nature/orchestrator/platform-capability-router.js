const KNOWN_PLATFORM_IDS = ["moltbook", "instreet", "evomap"];
function kindToCapability(kind) {
    if (kind === "exploration")
        return "feed.read";
    if (kind === "social")
        return "comment.reply";
    if (kind === "work")
        return "work.discover";
    if (kind === "outreach")
        return "message.send";
    return null;
}
function extractPlatformIdsFromGoals(goals, kind) {
    const capability = kindToCapability(kind);
    const results = new Set();
    for (const goal of goals) {
        const text = `${goal.description} ${goal.completionCriteria ?? ""}`.toLowerCase();
        for (const pid of KNOWN_PLATFORM_IDS) {
            if (text.includes(pid)) {
                results.add(pid);
            }
        }
        // Also match if goal text contains the capability name (e.g. "feed.read")
        if (capability && text.includes(capability.toLowerCase())) {
            // capability alone doesn't tell us platform; keep for later
        }
    }
    return [...results];
}
function extractPlatformIdsFromEvidence(refs) {
    const results = new Set();
    for (const ref of refs) {
        if (ref.kind === "connector_result" && ref.id) {
            for (const pid of KNOWN_PLATFORM_IDS) {
                if (ref.id.includes(pid)) {
                    results.add(pid);
                }
            }
        }
        // Parse platform:// URIs
        if (ref.uri && ref.uri.startsWith("platform://")) {
            const platformPart = ref.uri.slice("platform://".length).split("/")[0];
            if (platformPart && KNOWN_PLATFORM_IDS.includes(platformPart)) {
                results.add(platformPart);
            }
        }
    }
    return [...results];
}
function validatePlatformCapability(platformId, kind, registry) {
    const capability = kindToCapability(kind);
    if (!capability)
        return false;
    try {
        return registry.hasCapability(platformId, capability);
    }
    catch {
        return false;
    }
}
/**
 * Resolve an explicit platformId for a candidate intent kind.
 * Returns `undefined` when no unambiguous platform can be inferred.
 */
export function resolvePlatformForIntent(kind, context, registry) {
    const capability = kindToCapability(kind);
    if (!capability) {
        // Quiet, reflection, maintenance have no connector capability mapping.
        return undefined;
    }
    const candidates = [];
    if (context.acceptedGoals && context.acceptedGoals.length > 0) {
        candidates.push(...extractPlatformIdsFromGoals(context.acceptedGoals, kind));
    }
    if (context.evidenceRefs && context.evidenceRefs.length > 0) {
        candidates.push(...extractPlatformIdsFromEvidence(context.evidenceRefs));
    }
    // Deduplicate while preserving order
    const ordered = [...new Set(candidates)];
    if (registry) {
        for (const pid of ordered) {
            if (validatePlatformCapability(pid, kind, registry)) {
                return pid;
            }
        }
        // If none validated, return the first candidate anyway
        // (guard layer will deny with a specific reason)
        return ordered[0];
    }
    return ordered[0];
}
