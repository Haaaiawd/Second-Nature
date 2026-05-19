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
function getPlatformIds(registry) {
    if (registry) {
        return registry.listRegisteredPlatformIds();
    }
    // Fallback: built-in platforms when registry is absent (backward compat)
    return ["moltbook", "instreet", "evomap"];
}
function extractPlatformIdsFromGoals(goals, kind, platformIds) {
    const capability = kindToCapability(kind);
    const results = new Set();
    for (const goal of goals) {
        const text = `${goal.description} ${goal.completionCriteria ?? ""}`.toLowerCase();
        for (const pid of platformIds) {
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
function extractPlatformIdsFromEvidence(refs, platformIds) {
    const results = new Set();
    for (const ref of refs) {
        if (ref.kind === "connector_result" && ref.id) {
            for (const pid of platformIds) {
                if (ref.id.includes(pid)) {
                    results.add(pid);
                }
            }
        }
        // Parse platform:// URIs
        if (ref.uri && ref.uri.startsWith("platform://")) {
            const platformPart = ref.uri.slice("platform://".length).split("/")[0];
            if (platformPart && platformIds.includes(platformPart)) {
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
    catch (err) {
        // H-08: Log registry validation failures for observability.
        console.warn(`[platform-capability-router] Registry validation failed for ${platformId}:${capability}`, err);
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
    const platformIds = getPlatformIds(registry);
    const candidates = [];
    if (context.acceptedGoals && context.acceptedGoals.length > 0) {
        candidates.push(...extractPlatformIdsFromGoals(context.acceptedGoals, kind, platformIds));
    }
    if (context.evidenceRefs && context.evidenceRefs.length > 0) {
        candidates.push(...extractPlatformIdsFromEvidence(context.evidenceRefs, platformIds));
    }
    // Deduplicate while preserving order
    const ordered = [...new Set(candidates)];
    if (ordered.length === 0) {
        return undefined;
    }
    if (ordered.length > 1) {
        // Ambiguous: multiple platforms inferred → do not guess, return undefined.
        // Guard layer will deny with "ambiguous_platform" reason.
        return undefined;
    }
    const single = ordered[0];
    if (registry) {
        if (validatePlatformCapability(single, kind, registry)) {
            return single;
        }
        // Registry says unsupported → undefined (guard layer will deny)
        return undefined;
    }
    // No registry: best-effort return the single candidate (backward compat)
    return single;
}
